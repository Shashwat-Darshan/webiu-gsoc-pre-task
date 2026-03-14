# Scalable GitHub Data Aggregation System
**Architecture Design & Justification**

![System Architecture Diagram](./architecture_diagram.png)

---

## 1. Architecture Overview
The proposed architecture is a hybrid event-driven, "DB-First Serving" system. It splits responsibility cleanly across two independent flows:

- **Ingestion & Processing** — fully serverless and event-driven. GitHub Webhooks trigger Serverless Functions that enqueue payloads into a managed message queue (Amazon SQS / Upstash Kafka). Serverless workers consume the queue, fetch normalised data from GitHub, and write it to MongoDB. This layer scales to zero when idle and scales to thousands of concurrent executions during organisation-wide push bursts — with zero always-on cost.

- **Serving** — a traditional NestJS API that reads exclusively from MongoDB and Redis. It is always-on to guarantee consistent, sub-50ms response times for every frontend request. The frontend never touches GitHub directly; it only ever reads from this pre-aggregated internal layer.

---

## 2. Core Components

* **Ingestion Layer:** Serverless Functions (AWS Lambda / Vercel) receive incoming GitHub Webhook POST requests, verify the HMAC-SHA256 signature, and immediately enqueue the payload. A separate Cron Trigger fires every 6 hours as a reconciliation fallback.
* **Message Queue:** Amazon SQS / Upstash Kafka decouples webhook receipt from database writes. Provides native dead-letter queues (DLQ), automatic retries, and backpressure — no always-on broker infrastructure to manage.
* **Processing Layer:** Serverless Workers (Lambda) are triggered by the queue. Each worker fetches only the changed repository data from the GitHub GraphQL API (with ETag conditional requests) and upserts it into MongoDB.
* **Storage Layer:** MongoDB (Persistent Analytics Schema) for long-term data storage, and Redis for high-speed endpoint caching.
* **API Layer:** A NestJS backend (serving-only) that reads from MongoDB and Redis. It never calls the GitHub API directly; it exclusively serves pre-aggregated data to the frontend.

---

## 3. Rate Limit Handling
Minimizing GitHub API usage is achieved through a three-pronged strategy:
1. **Webhook Primary Ingestion:** We rely on GitHub pushing updates to us rather than polling their API continuously.
2. **ETag Caching for Polling:** When serverless workers poll the GraphQL API for historical syncing, they send `If-None-Match: <ETag>` headers. If the repository state hasn't changed, GitHub returns a `304 Not Modified`, which costs 0 points against the rate limit.
3. **Decoupled API:** User traffic never triggers a GitHub API call. Rate limits are only consumed by internal, controlled serverless workers.

---

## 4. Update Mechanism
The system utilises a hybrid update mechanism to ensure both real-time accuracy and absolute data integrity:
* **Real-time (Push):** GitHub Webhooks capture immediate state changes (pushes, pull requests, issues) and enqueue them into SQS via a Serverless Function.
* **Reconciliation (Pull):** A Cron Trigger fires every 6 hours to backfill any events that may have been dropped if a webhook failed to deliver.

---

## 5. Data Storage Strategy
* **Persistent Storage (MongoDB):** Stores heavy, structural repository data. This includes historical commit trends, language distributions, and contributor lists.
* **Dynamic Storage / Cache (Redis):** Stores highly volatile or frequently accessed data, such as real-time star counts or the final assembled JSON payload for the frontend `/api/repositories` endpoint.

---

## 6. Scalability Plan (300 to 10,000 Repositories)
Scaling from 300 to 10,000 repositories creates massive bursts of webhook traffic (e.g., when an organisation pushes a global update).
* **Ingestion Layer:** Because the webhook receiver is a Serverless Function, it scales to thousands of concurrent executions automatically with no pre-provisioning. SQS absorbs the burst and releases it to workers at a controlled rate.
* **Processing Layer:** Serverless Workers scale horizontally in direct proportion to SQS queue depth — each message triggers one worker invocation. No manual scaling configuration required.
* **Database Scaling:** As read queries scale up, MongoDB can be expanded using Replica Sets. Workers write strictly to the Primary node, while the NestJS API Layer reads exclusively from Secondary nodes.

---

## 7. Performance Optimization
To ensure fast frontend response times:
* **Endpoint Caching:** The NestJS API Service wraps its responses in Redis. If the frontend requests data for a repository, the API serves the Redis cache (typically sub-10ms response time).
* **Pre-aggregation:** Serverless workers pre-compute heavy metrics (like "Complexity Score" or 30-day commit trends) and store the final calculated values in MongoDB, rather than computing them on the fly per request.

---

## 8. Failure Handling
* **API Failures / Rate Limit Exhaustion:** If serverless workers hit the GitHub API rate limit or if GitHub goes down, the workers simply stop consuming from the queue (SQS retries with exponential backoff). The NestJS API Service implements "Graceful Staleness" — it continues serving the last known good snapshot from MongoDB/Redis, ensuring 100% frontend uptime.
* **Unavailable Repositories:** Workers wrap API calls in standard try/catch blocks. If a 404 is returned (repo deleted or made private), the worker flags the repository status as "Archived/Unavailable" in MongoDB, and the frontend updates its UI accordingly.

---

## 9. API Flow (Frontend to Backend)
1. The Website Frontend sends a `GET /api/repositories` request.
2. The NestJS API Service intercepts the request and checks Redis for a cached response.
3. **Cache Hit:** Redis returns the payload immediately.
4. **Cache Miss:** The API Service queries MongoDB for the pre-aggregated data, formats it, asynchronously updates the Redis cache with a new TTL (Time To Live), and returns the JSON payload to the frontend.

---

## 10. Technology Choices & Justification

| Layer | Technology | Justification |
|-------|-----------|--------------|
| **Ingestion Layer** | Serverless Functions (AWS Lambda / Vercel) | Webhook receivers are idle 90% of the time — serverless scales to exactly zero during quiet periods and instantly handles thousands of concurrent push events during org-wide bursts, with no always-on cost |
| **Message Queue** | Amazon SQS / Upstash Kafka (Serverless) | Decouples webhook receipt from database writes; native DLQ and automatic retries for GitHub API rate-limit failures (HTTP 429); no broker infrastructure to manage |
| **Processing Workers** | Serverless Workers (Lambda, SQS-triggered) | Each queue message triggers one worker; scales in direct proportion to queue depth; independently restartable per data domain |
| **API Serving Layer** | NestJS (TypeScript) | Already adopted by the Webiu project; always-on for consistent low-latency serving; native support for GraphQL, caching, and scheduling; scoped strictly to reading from MongoDB/Redis — never calls GitHub |
| **Persistent Storage** | MongoDB | Its flexible BSON document model easily accommodates the deeply nested and varied JSON payloads returned by GitHub's APIs |
| **Cache** | Redis | The industry standard for high-performance, in-memory caching; dual-purpose as both response cache and rate-limit budget store |

> **The key split:** Serverless owns everything upstream of the database (ingest → queue → process → write). NestJS owns everything downstream (read → cache → serve). Neither layer crosses into the other's responsibility.

---

See full documentation:

- [Architecture Diagram](./Idea-DOCS/architecture-diagram.md) — Mermaid system diagram, component table, scaling diagram
- [Design Explanation](./Idea-DOCS/design-doc.md) — 2-page design covering all required areas
- [API Flow](./Idea-DOCS/api-flow.md) — Sequence diagrams + REST endpoint specs + GraphQL schema
- [Technology Justification](./Idea-DOCS/tech-justification.md) — Decision table with rejected alternatives

> **GSoC Connection:** This architecture is the production-ready north star for the GSoC idea. The phases in [`GSOC_IDEA.md`](../GSOC_IDEA.md) are the incremental delivery path toward this design — the serverless ingestion pipeline is the Phase 6 PoC target, MongoDB activates the scaffolded persistence layer, and NestJS is extended (not replaced) to add the serving endpoints.