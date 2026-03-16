# Technology Justification — Task 1

## Stack Decision: Hybrid Serverless Ingestion + NestJS Serving

> The architecture intentionally uses **two different paradigms** for two different problems:
> - **Serverless** for everything upstream of the database (ingest → queue → process → write)
> - **NestJS** for everything downstream (read → cache → serve → frontend)

---

## Technology Choices

| Layer | Technology | Justification |
|-------|-----------|--------------|
| **Ingestion Layer** | Serverless Functions (AWS Lambda / Vercel) | Webhook receivers are idle 90% of the time — serverless scales to exactly zero during quiet periods and instantly handles thousands of concurrent push events during org-wide bursts, with no always-on infrastructure cost. A traditional always-on NestJS controller would waste compute 24/7 waiting for webhooks. |
| **Message Queue** | Amazon SQS / Upstash Kafka (Serverless) | Decouples webhook receipt from database writes. Managed serverless queues provide native dead-letter queues (DLQ), automatic retries for GitHub API rate-limit failures (HTTP 429), and backpressure — all without managing a broker like RabbitMQ or a Redis-backed BullMQ instance. |
| **Processing Workers** | Serverless Workers (Lambda, SQS-triggered) | Each SQS message triggers exactly one worker invocation. Workers scale in direct proportion to queue depth — no manual concurrency configuration. Each data domain (metadata, contributors, languages, issues) is an independently restartable worker function. |
| **Cron Trigger** | Amazon EventBridge Scheduler | Serverless cron rule configured with `0 */6 * * ? *` that triggers a Lambda invocation every 6 hours for the reconciliation sweep. Zero cost between invocations — no always-on process. Equivalent on Vercel: Vercel Cron Jobs. The scheduled Lambda uses the same SQS queue and downstream workers as the webhook path — no duplicate infrastructure needed. |
| **API Serving Layer** | NestJS 10 (TypeScript) | Already adopted by the Webiu project. Scoped strictly to **reading from MongoDB and Redis** — it never calls GitHub directly. Always-on to guarantee consistent sub-50ms response times for every frontend request. Native support for GraphQL (`@nestjs/apollo`) and caching (`@nestjs/cache-manager`). |
| **API Style** | REST + GraphQL (dual) | REST for webhook endpoints and simple consumers; GraphQL lets the Angular frontend request exactly the fields it needs per component, eliminating over-fetching across 300+ repo cards. |
| **Persistent Storage** | MongoDB + Mongoose | Already used in Webiu (`@nestjs/mongoose` is an existing dependency). Flexible BSON document model accommodates the deeply nested and varied JSON payloads returned by the GitHub API. Easy to add new fields as the API evolves. Indexed on `owner`, `name`, `stars`, `updatedAt` for fast serving-layer queries. |
| **Cache** | Redis | Sub-millisecond reads; native TTL support per key. Dual-purpose: HTTP response cache for the NestJS serving layer and a rate-limit budget store for tracking `X-RateLimit-Remaining` across serverless worker invocations. |
| **Webhook Auth** | HMAC-SHA256 | GitHub's own recommended mechanism. The Serverless Function validates the `X-Hub-Signature-256` header before enqueuing — invalid requests are rejected at the edge with 401, never reaching the queue. |
| **GitHub API** | REST v3 + GraphQL v4 | REST v3 for webhooks and simple single-resource fetches. GraphQL v4 for batch-fetching up to 100 repo metadata nodes per request — reduces rate-limit consumption from ~1,200 REST calls to ~10–15 GraphQL calls for a full sweep of 300 repos. |
| **GitHub Auth** | GitHub App (long-term) | GitHub Apps receive 15,000 req/hr per installation vs 5,000 for PATs. Supports installation tokens scoped per org. Better for org-wide webhook registration and secret management. |
| **Frontend** | Angular 17 + SSR | Existing Webiu stack. SSR ensures pages are indexable and fast on first load. PWA caching layer reduces repeat load times for the project dashboard. |
| **Containerisation** | Docker + docker-compose | Multi-stage builds for the NestJS serving layer (aligned with the existing Webiu Dockerfile standard). Non-root user. Compose for local dev with MongoDB + Redis + API. Serverless functions are deployed separately via their platform CLI. |
| **Scaling** | Serverless-native + Kubernetes (HPA) for NestJS | Ingestion and processing layers scale automatically with queue depth — no Kubernetes required there. The NestJS serving layer uses HPA scaled on CPU/request rate. Redis Cluster and MongoDB Replica Sets for storage scaling. |
| **Observability** | Winston logger + Prometheus metrics | Structured logs from NestJS; CloudWatch / Vercel logs for serverless functions. Expose `/metrics` endpoint for cache hit rate, queue depth, API latency. Grafana dashboard for ops visibility. |

---

## Why Not Alternatives?

| Alternative | Rejected Because |
|------------|-----------------|
| **NestJS always-on server for webhook ingestion** | Wastes compute 24/7 waiting for push events. During an org-wide burst (10,000 repos all pushing at once), a single always-on instance becomes a bottleneck. Serverless handles the burst natively with zero pre-provisioning. |
| **BullMQ + Redis instead of SQS / Kafka** | BullMQ requires managing a Redis instance as a broker. SQS and Upstash Kafka are fully managed serverless queues — no broker to scale, patch, or monitor. DLQ, retry policies, and visibility timeouts are native features, not bolt-ons. |
| **RabbitMQ as message broker** | Adds a separate always-on broker with its own scaling, ops, and monitoring burden. Serverless queues (SQS / Kafka) eliminate this entirely. |
| **REST only (no GraphQL)** | Over-fetches on list pages. The Angular frontend would need to make N requests for N repo detail cards. GraphQL lets each component request exactly the fields it renders. |
| **PostgreSQL instead of MongoDB** | Webiu already uses MongoDB (`@nestjs/mongoose` is an existing dependency). GitHub API response shapes vary per endpoint — a strict relational schema would require frequent migrations as the API evolves. |
| **GitHub REST v3 only (no GraphQL v4)** | Each repo requires ~4 REST calls (metadata + languages + contributors + issues) = 1,200 calls for a full sweep of 300 repos. GraphQL v4 batches all into ~10–15 calls — a 100× reduction in rate-limit consumption. |
| **In-memory cache instead of Redis** | Not shared across horizontally scaled NestJS pods. Lost on restart. Cannot be used as a shared rate-limit budget tracker across multiple serverless worker invocations. |
| **Fully serverless API serving (Lambda for GET /api/repositories)** | Cold starts introduce unpredictable latency on the critical path of every frontend page load. The NestJS serving layer is always-on precisely because consistent sub-50ms latency matters here. Serverless is only appropriate for the bursty, latency-tolerant ingestion workload. |
| **`@nestjs/schedule` for cron reconciliation** | Runs on the always-on NestJS serving pod — ties a background ingestion concern to the serving layer, violating the hard boundary between ingestion and serving. Amazon EventBridge fires a Lambda invocation serverlessly and costs nothing between sweeps. |