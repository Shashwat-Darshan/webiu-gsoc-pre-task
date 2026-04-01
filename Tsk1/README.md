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

* **Ingestion Layer:** Serverless Functions (AWS Lambda / Vercel) receive incoming GitHub Webhook POST requests, verify the HMAC-SHA256 signature, and immediately enqueue the payload. A separate **Amazon EventBridge Scheduler** rule (serverless cron — `0 */6 * * ? *`) triggers the same Lambda function every 6 hours as a reconciliation fallback. No always-on server is required.
* **Message Queue:** Amazon SQS / Upstash Kafka decouples webhook receipt from database writes. Provides native dead-letter queues (DLQ), automatic retries, and backpressure — no always-on broker infrastructure to manage.
* **Processing Layer:** Serverless Workers (Lambda) are triggered by the queue. Each worker fetches only the changed repository data from the GitHub GraphQL API (with ETag conditional requests) and upserts it into MongoDB.
* **Storage Layer:** MongoDB (Persistent Analytics Schema) for long-term data storage, and Redis for high-speed endpoint caching.
* **API Layer:** A NestJS backend (serving-only) that reads from MongoDB and Redis. It never calls the GitHub API directly; it exclusively serves pre-aggregated data to the frontend.

---

## 3. Rate Limit Handling
Minimizing GitHub API usage is achieved through a five-strategy approach:
1. **Webhook Primary Ingestion** — zero polling for real-time events
2. **ETag Conditional Requests** — `304 Not Modified` costs 0 rate-limit points
3. **GraphQL Batching** — up to 100 repo metadata nodes per query vs 1 per REST call
4. **Incremental Sync** — `updated_at` filtering on every cron sweep (only changed repos)
5. **Shared Rate-Limit Budget Tracker** — each Lambda worker writes `X-RateLimit-Remaining` to Redis; workers stop dequeuing if the counter drops below threshold (< 200)

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

## 12. Task 1 to Task 2 Bridge

Task 1 delivered the production architecture baseline. Task 2 then delivered a working analyzer prototype (frontend + backend) validating core ideas in deployable form.

- Task 1 delivered: architecture, scalability, reliability, and data flow design
- Task 2 delivered: scoring API (`model-b-v2`), explainability, and real-world deployment

For complete scoring specifications, model logic, guardrails, and interpretation details, see:
- `../Tsk2/docs/SCORING.md`

---

## 13. Technical Scoring Model (model-b-v2)

Task 2 implements the repository analyzer using the confidence-weighted `model-b-v2` classifier. This section centralizes the production scoring logic in Task 1 so technical reviewers can evaluate architecture and model in one place.

### 13.1 Input Signals

Six core dimensions are used:

- `S` (Scale): stars, contributors, commits (90d)
- `F` (Friction): file count, folder depth, staleness
- `W` (Welcomingness): community health %, good-first-issue count, issue closure rate
- `A` (Activity momentum): commits, closed issues, releases, staleness, closure rate
- `E` (Ecosystem adjustment): language family, setup complexity, language spread
- `Q` (Data quality penalty): reliability penalty from fetch completeness

### 13.2 Normalization

Power-law normalization is used to reduce popularity bias:

$$
	ext{norm}(x,m)=\text{clamp}\left(\frac{\log_{10}(x+1)}{\log_{10}(m+1)},0,1\right)
$$

### 13.3 Composite Scores and Probability

Raw core difficulty:

$$
D_{core}=0.55F-1.45W-0.22S+0.35(1-A)
$$

Adjusted difficulty:

$$
D_{adj}=D_{core}\cdot E + 0.40Q
$$

Advanced probability:

$$
P_{advanced}=\frac{1}{1+e^{-3.4(D_{adj}-0.26)}}
$$

### 13.4 Decision Boundaries and Guardrails

- Beginner: $P_{advanced}<0.35$ (and passes guardrails)
- Intermediate: $0.35\le P_{advanced}\le0.70$
- Advanced: $P_{advanced}>0.70$

Stale-lock guardrail:

- If `daysSinceLastCommit > 90`, Beginner is downgraded to Intermediate.

Mega-complexity guardrail:

- If `P_advanced < 0.35` but repository surface area is very large (`fileCount >= 10000` or large-tree fallback signals) and both friction and scale are high, Beginner is upgraded to Intermediate.

### 13.5 Output Contract

- `difficulty`: Beginner | Intermediate | Advanced
- `confidence_score`: $P_{advanced}$ (rounded to 4 decimals)
- `activity_score`: $A \times 100$ (rounded)
- `complexity_score`: $F \times 100$ (rounded)

Full equations, adjustment tables, and interpretation rules are maintained in:
- `../Tsk2/docs/SCORING.md`

---

## 14. Reviewer Checklist (Technical)

Use this list when reviewing architecture and model quality:

- Clear split between event-driven ingestion and DB-first serving
- Explicit handling of GitHub API limits (batching, ETag, budget tracking)
- Scoring model includes `S`, `F`, `W`, `A`, `E`, and `Q`
- Equations and constants match production spec (`3.4`, `0.26`)
- Guardrails are implemented (stale-lock and mega-complexity)
- Explainability and confidence outputs are exposed to API and UI
- Failure modes covered (rate limits, API outages, unavailable repositories)
- Incremental path from current analyzer to production-scale architecture