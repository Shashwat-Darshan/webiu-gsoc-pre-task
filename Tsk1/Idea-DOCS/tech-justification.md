# Technology Justification — Task 1

| Layer | Technology | Justification |
|-------|-----------|--------------|
| **Ingestion Layer** | Serverless Functions (AWS Lambda / Vercel) | Replaces a traditional always-on Node.js worker for webhooks. Serverless scales to exactly zero during inactive periods (saving costs) and instantly scales to thousands of concurrent executions during massive organization-wide push events without locking the main API. |
| **API style** | REST + GraphQL (dual) | REST for simple consumers and webhooks; GraphQL lets the Angular frontend request exactly the data it needs per component, eliminating over-fetching across 300+ repo displays |
| **Message Queue** | Amazon SQS / Upstash Kafka (Serverless) | Decouples the webhook ingestion from the database writes. Serverless queues provide native dead-letter queues (DLQ) and automatic retries for GitHub API rate-limit failures (HTTP 429) without managing Redis infrastructure. |
| **Persistent storage** | MongoDB + Mongoose | Already used in Webiu; flexible document model suits schemaless GitHub API responses; easy to add new fields as GitHub API evolves; indexing on `owner`, `name`, `stars`, `updatedAt` for fast queries |
| **Cache** | Redis | Sub-millisecond reads; native TTL support per key; used as dual-purpose (queue + cache) to minimize infrastructure; `@nestjs/cache-manager` provides transparent interceptor-level caching |
| **Scheduling** | `@nestjs/schedule` | Built-in NestJS cron decorator; no extra infrastructure; integrates with Bull for job dispatch |
| **Webhook auth** | HMAC-SHA256 | GitHub's own recommended mechanism; validates `X-Hub-Signature-256` header before any processing |
| **GitHub API** | REST v3 + GraphQL v4 | REST for webhooks and simple resource fetches; GraphQL v4 for batching up to 100 repo metadata fetches per request (drastically reduces rate-limit consumption) |
| **GitHub auth** | GitHub App (long-term) | GitHub Apps receive 15,000 req/hr per installation vs 5,000 for PATs; supports installation tokens; better for org-wide webhook management |
| **Frontend** | Angular 17 + SSR | Existing Webiu stack; SSR ensures pages are indexable and fast on first load; PWA caching layer reduces repeat load times |
| **Containerization** | Docker + docker-compose | Multi-stage builds (aligned with Webiu Dockerfile standard); non-root user; compose for local dev with Mongo + Redis + API |
| **Scaling** | Kubernetes (HPA) | When volume grows: HPA scales NestJS pods and Bull worker pods based on CPU/queue-depth metrics; Redis Cluster and MongoDB replica sets for storage scaling |
| **Observability** | Winston logger + Prometheus metrics | Structured logs from NestJS; expose `/metrics` endpoint for queue depth, cache hit rate, API latency; Grafana dashboard for ops visibility |

## Why Not Alternatives?

| Alternative | Rejected Because |
|------------|-----------------|
| REST only (no GraphQL) | Over-fetches on list pages; frontend must make N requests for N repo detail cards |
| PostgreSQL instead of MongoDB | Webiu already uses Mongo; GitHub API response shapes vary per endpoint, making strict relational schema fragile |
| RabbitMQ instead of BullMQ | BullMQ is Redis-native (Redis already in stack); RabbitMQ adds a separate broker with its own scaling/ops burden |
| GitHub REST v3 only (no GraphQL) | Each repo requires ~4 calls (metadata + languages + contributors + issues) = 1,200 calls per full sweep of 300 repos; GraphQL batches all into ~10–15 calls |
| In-memory cache (instead of Redis) | Not shared across horizontally scaled API pods; lost on restart |
