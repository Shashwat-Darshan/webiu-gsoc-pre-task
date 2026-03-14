# Scalable GitHub Data Aggregation System
**Architecture Design & Justification**

![System Architecture Diagram](./architecture_diagram.png)

---

## 1. Architecture Overview
The proposed architecture is an event-driven, "DB-First Serving" system designed to aggregate data from 300+ GitHub repositories. To ensure maximum frontend performance and strictly avoid GitHub API rate limits on user-facing requests, the system decouples data ingestion from data serving. The frontend never waits on a live GitHub API call; it exclusively reads from an internal, pre-aggregated database and caching layer.

## 2. Core Components
* **Ingestion Layer:** An API Gateway exposed to receive incoming GitHub Webhooks.
* **Processing Layer:** A Message Broker (BullMQ, Redis-backed) to queue incoming payloads, and a pool of NestJS Background Workers to safely process the queue and perform background API fetches.
* **Storage Layer:** MongoDB (Persistent Analytics Schema) for long-term data storage, and Redis for high-speed endpoint caching.
* **API Layer:** A NestJS backend that serves data to the frontend strictly from the Storage Layer.

## 3. Rate Limit Handling
Minimizing GitHub API usage is achieved through a three-pronged strategy:
1. **Webhook Primary Ingestion:** We rely on GitHub pushing updates to us rather than polling their API continuously.
2. **ETag Caching for Polling:** When background workers do poll the GraphQL API for historical syncing, they send `If-None-Match: <ETag>` headers. If the repository state hasn't changed, GitHub returns a `304 Not Modified`, which costs 0 points against the rate limit.
3. **Decoupled API:** User traffic never triggers a GitHub API call. Rate limits are only consumed by internal, controlled background workers.

## 4. Update Mechanism
The system utilizes a hybrid update mechanism to ensure both real-time accuracy and absolute data integrity:
* **Real-time (Push):** GitHub Webhooks capture immediate state changes (pushes, pull requests, issues) and push them to the ingestion queue.
* **Reconciliation (Pull):** Scheduled Cron Jobs run nightly to execute "incremental updates." These workers fetch data via the GraphQL API to backfill any events that might have been dropped if a webhook failed to deliver.

## 5. Data Storage Strategy
* **Persistent Storage (MongoDB):** Stores heavy, structural repository data. This includes historical commit trends, language distributions, and contributor lists.
* **Dynamic Storage / Cache (Redis):** Stores highly volatile or frequently accessed data, such as real-time star counts or the final assembled JSON payload for the frontend `/api/repositories` endpoint.

## 6. Scalability Plan (300 to 10,000 Repositories)
Scaling from 300 to 10,000 repositories creates massive bursts of webhook traffic (e.g., when an organization pushes a global update).
* **The Message Broker:** The API Gateway immediately responds to GitHub with a `200 OK` and pushes the payload into BullMQ. This acts as a shock absorber. The NestJS Background Workers pull from this queue at a controlled, steady rate.
* **Database Scaling:** As read queries scale up, MongoDB can be expanded using Replica Sets. Workers will write strictly to the Primary node, while the API Layer reads exclusively from Secondary nodes.

## 7. Performance Optimization
To ensure fast frontend response times:
* **Endpoint Caching:** The NestJS API Service wraps its responses in Redis. If the frontend requests data for a repository, the API serves the Redis cache (typically sub-10ms response time).
* **Pre-aggregation:** Background workers pre-compute heavy metrics (like "Complexity Score" or 30-day commit trends) and store the final calculated values in MongoDB, rather than the database calculating them on the fly per request.

## 8. Failure Handling
* **API Failures / Rate Limit Exhaustion:** If background workers hit the GitHub API rate limit or if GitHub goes down, the ingestion workers simply pause. The NestJS API Service implements "Graceful Staleness"—it continues serving the last known good snapshot from MongoDB/Redis, ensuring 100% frontend uptime.
* **Unavailable Repositories:** Workers wrap API calls in standard `try/catch` blocks. If a 404 is returned (repo deleted or made private), the worker flags the repository status as "Archived/Unavailable" in MongoDB, and the frontend updates its UI accordingly.

## 9. API Flow (Frontend to Backend)
1. The Website Frontend sends a `GET /api/repositories` request.
2. The NestJS API Service intercepts the request and checks Redis for a cached response.
3. **Cache Hit:** Redis returns the payload immediately.
4. **Cache Miss:** The API Service queries MongoDB for the pre-aggregated data, formats it, asynchronously updates the Redis cache with a new TTL (Time To Live), and returns the JSON payload to the frontend.

## 10. Technology Choices & Justification

| Layer | Technology | Justification |
|-------|-----------|--------------|
| **Backend Framework** | NestJS (TypeScript) | Already adopted by the Webiu project; strong module system; native support for GraphQL, queues, scheduling, and caching; decorator-based design matches the existing codebase |
| **Job Queue** | BullMQ + Redis | Redis-native, battle-tested in the Node.js ecosystem; first-class NestJS integration via `@nestjs/bull`; provides retry, exponential backoff, concurrency control, priority, and DLQ out of the box |
| **Persistent Storage** | MongoDB | Its flexible BSON document model easily accommodates the deeply nested and varied JSON payloads returned by GitHub's APIs |
| **Cache** | Redis | The industry standard for high-performance, in-memory caching; dual-purpose as both job queue backend and HTTP response cache to minimise infrastructure |

> **GSoC Connection:** This architecture is the production-ready north star for the GSoC idea. The phases in [`GSOC_IDEA.md`](../GSOC_IDEA.md) are the incremental delivery path toward this design — BullMQ replaces the current in-memory cache, MongoDB activates the scaffolded persistence layer, and the webhook ingestion pipeline is the Phase 6 PoC target.

See full documentation:

- [Architecture Diagram](./Idea-DOCS/architecture-diagram.md) — Mermaid system diagram, component table, scaling diagram
- [Design Explanation](./Idea-DOCS/design-doc.md) — 2-page design covering all 8 required areas
- [API Flow](./Idea-DOCS/api-flow.md) — Sequence diagrams + REST endpoint specs + GraphQL schema
- [Technology Justification](./Idea-DOCS/tech-justification.md) — Decision table with rejected alternatives