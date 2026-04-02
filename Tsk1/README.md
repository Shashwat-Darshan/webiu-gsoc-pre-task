# Scalable GitHub Data Aggregation System
**Architecture Design & Justification**

![System Architecture Diagram](./architecture_diagram.png)

---

## 1. Architecture Overview
The finalized Task 1 architecture is a hybrid event-driven, "DB-First Serving" system. It splits responsibility cleanly across two independent flows:

- **Ingestion & Processing** — fully serverless and event-driven. GitHub Webhooks trigger Serverless Functions that enqueue payloads into a managed message queue (Amazon SQS / Upstash Kafka). Serverless workers consume the queue, fetch normalised data from GitHub, and write it to MongoDB. This layer scales to zero when idle and scales to thousands of concurrent executions during organisation-wide push bursts — with zero always-on cost.

- **Serving** — a traditional NestJS API that reads exclusively from MongoDB and Redis. It is always-on to guarantee consistent, sub-50ms response times for every frontend request. The frontend never touches GitHub directly; it only ever reads from this pre-aggregated internal layer.

---

## 2. Core Components

| Component | Role |
|-----------|------|
| **Serverless Functions (Lambda / Vercel)** | Receive webhook POSTs, verify HMAC-SHA256 signature, enqueue payload to SQS |
| **Amazon EventBridge Scheduler** | Serverless cron (0 */6 * * ? *) triggers reconciliation sweep every 6 hours |
| **Amazon SQS** | Decouples webhook receipt from database writes; provides DLQ and automatic retries |
| **Serverless Workers (Lambda, SQS-triggered)** | Fetch changed repo data from GitHub GraphQL API (with ETag), upsert to MongoDB |
| **MongoDB** | Persistent storage for structural and historical repository data |
| **Redis** | Response cache plus shared rate-limit budget store |
| **NestJS API** | Serving-only backend — reads from MongoDB/Redis, never calls GitHub |

---

## 3. Rate Limit Handling

Five strategies are combined to stay well within GitHub API limits:

1. **Webhook-primary ingestion** — zero polling for real-time events; API is only called when data actually changes
2. **ETag conditional requests** — responses return 304 Not Modified at zero rate-limit cost when data hasn't changed
3. **GraphQL batching** — up to 100 repository metadata nodes per query vs 1 per REST call
4. **Incremental sync** — cron sweeps filter by updated_at, so only genuinely changed repos are re-fetched
5. **Shared rate-limit budget tracker** — each Lambda worker writes X-RateLimit-Remaining to Redis; workers stop dequeuing when counter drops below safe threshold (< 200)

---

## 4. Update Mechanism

A hybrid push/pull strategy ensures both real-time accuracy and eventual consistency:

- **Push (real-time):** GitHub Webhooks capture state changes (pushes, PRs, issues) immediately and enqueue them to SQS via a Serverless Function.
- **Pull (reconciliation):** EventBridge Scheduler fires every 6 hours to backfill any events missed due to webhook delivery failures.

This means the system never relies solely on GitHub's webhook delivery guarantees.

---

## 5. Data Storage Strategy

**Stored persistently in MongoDB:**
- Structural repository data (name, description, topics, language breakdown)
- Historical trends (commit frequency, contributor history, star growth)
- Pre-computed metrics (complexity score, 30-day activity trend)

**Cached in Redis (high volatility / high frequency):**
- Real-time star/fork/watcher counts
- Final assembled JSON payload for `/api/repositories` (with TTL)
- Rate-limit budget counter shared across all worker instances

The processing layer pre-computes heavy metrics at write time, so the serving layer never performs aggregation on the fly.

---

## 6. Scalability Plan — 300 to 10,000 Repositories

Scaling to 10,000 repos creates webhook burst traffic (e.g., an org-wide push event hitting thousands of repos simultaneously).

- **Ingestion layer:** Serverless Functions scale to thousands of concurrent executions automatically — no pre-provisioning, no queue overflow.
- **Processing layer:** SQS absorbs the burst and releases it at a controlled rate. Workers scale horizontally in direct proportion to queue depth.
- **Database layer:** MongoDB Replica Sets — workers write to the Primary, the NestJS API reads from Secondaries. Read throughput scales independently of write throughput.

No configuration changes are needed between 300 and 10,000 repos. The architecture is inherently elastic.

---

## 7. Performance Optimization

- **Endpoint caching (Redis):** The NestJS API wraps all responses in Redis. Cache hits return in under 10ms. On miss, MongoDB is queried, the result is cached with a TTL, and the payload is returned.
- **Pre-aggregation:** Workers store final computed values (complexity scores, trend data) directly in MongoDB. The API layer performs no aggregation per request.
- **DB-first serving:** The frontend is always served from the internal data layer — GitHub API latency never appears in the critical path.

---

## 8. Failure Handling

| Failure Mode | Response |
|---|---|
| GitHub API rate limit hit | Workers stop consuming SQS; SQS retries with exponential backoff. NestJS serves the last known good snapshot from MongoDB/Redis — frontend remains fully operational. |
| GitHub API outage | Same as above — Graceful Staleness. Data may become slightly stale; integrity is restored on next successful reconciliation. |
| Webhook delivery failure | 6-hour cron reconciliation sweep catches all missed events. |
| Repository deleted or made private | Worker receives a 404, flags the repo as status: "unavailable" in MongoDB. The frontend reflects this state. |
| Worker crash mid-processing | SQS visibility timeout expires; message is redelivered to another worker. Idempotent upserts prevent duplicate writes. |

---

## 9. API Flow

```
Frontend  →  GET /api/repositories
             │
             ↓
        NestJS API
             │
       Check Redis cache
             │
    ┌──────│──────┐
 Cache HIT         Cache MISS
    │                 │
 Return payload   Query MongoDB
                      │
                Format response
                      │
               Update Redis (TTL)
                      │
               Return payload
```

The frontend has a single integration point: the NestJS REST API. MongoDB and Redis are internal to the backend. GitHub is invisible to the frontend entirely.

For detailed diagrams, sequence flows, and endpoint specs, see [API Flow](./Idea-DOCS/api-flow.md).

---

## 10. Technology Choices & Justification

| Layer | Technology | Justification |
|-------|-----------|--------------|
| **Ingestion Layer** | Serverless Functions (AWS Lambda / Vercel) | Webhook receivers are idle 90% of the time — serverless scales to exactly zero during quiet periods and instantly handles thousands of concurrent push events during org-wide bursts, with no always-on cost |
| **Message Queue** | Amazon SQS / Upstash Kafka (Serverless) | Decouples webhook receipt from database writes; native DLQ and automatic retries for GitHub API rate-limit failures (HTTP 429); no broker infrastructure to manage |
| **Processing Workers** | Serverless Workers (Lambda, SQS-triggered) | Each queue message triggers one worker; scales in direct proportion to queue depth; independently restartable per data domain |
| **Cron Trigger** | Amazon EventBridge Scheduler | Serverless cron rule (`0 */6 * * ? *`) that triggers a Lambda invocation every 6 hours for the reconciliation sweep. Zero cost between invocations. No always-on server required. Vercel equivalent: Vercel Cron Jobs. |
| **API Serving Layer** | NestJS (TypeScript) | Already adopted by the Webiu project; always-on for consistent low-latency serving; native support for GraphQL and caching; scoped strictly to reading from MongoDB/Redis — never calls GitHub |
| **Persistent Storage** | MongoDB | Its flexible BSON document model easily accommodates the deeply nested and varied JSON payloads returned by GitHub's APIs |
| **Cache** | Redis | The industry standard for high-performance, in-memory caching; dual-purpose as both response cache and rate-limit budget store |

> **The key split:** Serverless owns everything upstream of the database (ingest → queue → process → write). NestJS owns everything downstream (read → cache → serve). Neither layer crosses into the other's responsibility.

---

See full documentation:

- [Architecture Diagram](./Idea-DOCS/architecture-diagram.md) — Mermaid system diagram, component table, scaling diagram
- [Design Explanation](./Idea-DOCS/design-doc.md) — 2-page design covering all required areas
- [API Flow](./Idea-DOCS/api-flow.md) — Sequence diagrams + REST endpoint specs + GraphQL schema
- [Technology Justification](./Idea-DOCS/tech-justification.md) — Decision table with rejected alternatives

> **GSoC Connection:** This document captures the completed Task 1 architecture baseline for the GSoC idea. The phases in [`GSOC_IDEA.md`](../GSOC_IDEA.md) describe the incremental implementation path from this baseline.

---

## 11. Deliverables Completed

- Architecture blueprint with scale path from 300 to 10,000 repositories
- Hybrid update strategy (webhooks + scheduled reconciliation)
- DB-first serving model for low-latency frontend reads
- Technology decision matrix with rejected alternatives
- End-to-end API flow documentation for frontend integration
