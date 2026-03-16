# Architecture Diagram — Scalable GitHub Data Aggregation System

## System Architecture (Mermaid)

```mermaid
graph TB
    subgraph Sources["⚡ Data Sources (GitHub)"]
        WH[GitHub Webhooks<br/>Push / PR / Issue / Star events]
        GH[GitHub API<br/>REST v3 + GraphQL v4]
    end

    subgraph Ingestion["☁️ Ingestion Layer — Serverless"]
        FN[Serverless Function<br/>AWS Lambda / Vercel<br/>Verify HMAC-SHA256 → Enqueue]
        CRON[Amazon EventBridge<br/>Cron: 0 */6 * * ? *<br/>Incremental reconciliation]
    end

    subgraph Queue["📨 Message Queue — Managed Serverless"]
        SQS[Amazon SQS / Upstash Kafka<br/>Auto-Retry]
        DLQ[Dead Letter Queue<br/>Permanently failed jobs]
    end

    subgraph Processing["⚙️ Processing Layer — Serverless Workers (SQS-triggered)"]
        W1[Lambda Worker<br/>Repo Metadata]
        W2[Lambda Worker<br/>Contributors]
        W3[Lambda Worker<br/>Languages]
        W4[Lambda Worker<br/>Issues / PRs]
    end

    subgraph Storage["🗄️ Storage Layer"]
        MONGO[(MongoDB<br/>Persistent Store)]
        REDIS[(Redis<br/>Response Cache +<br/>Rate-Limit Budget)]
    end

    subgraph Serving["🖥️ Serving Layer — NestJS (Read-Only from Storage)"]
        REST[REST API<br/>NestJS Controllers]
        GQL[GraphQL API<br/>NestJS Apollo]
        CACHE[Cache Interceptor<br/>Redis TTL]
    end

    subgraph Frontend["🌐 Frontend"]
        UI[Angular 17 SPA<br/>SSR + PWA]
    end

    %% Ingestion flow
    WH -->|POST push event| FN
    CRON -->|Trigger sweep| FN
    FN -->|Enqueue payload| SQS

    %% Processing flow
    SQS --> W1
    SQS --> W2
    SQS --> W3
    SQS --> W4
    W1 & W2 & W3 & W4 <-->|Fetch + ETag sync| GH
    W1 & W2 & W3 & W4 -->|Upsert normalised data| MONGO
    W1 & W2 & W3 & W4 -->|Invalidate cache key| REDIS
    SQS -->|On max retries| DLQ

    %% Serving flow
    UI -->|GET /api/repositories| REST
    UI -->|GraphQL query| GQL
    REST --> CACHE
    GQL --> CACHE
    CACHE -->|Cache hit| UI
    CACHE -->|Cache miss| MONGO
    MONGO -->|Populate + set TTL| CACHE
```

> **The hard boundary:** Serverless owns everything from GitHub event → queue → worker → write.
> NestJS owns everything from read → cache → serve → frontend.
> Neither layer crosses into the other's responsibility.

---

## Component Responsibilities

| Component | Layer | Role |
|-----------|-------|------|
| **GitHub Webhooks** | Source | Pushes real-time events (push, PR, issue, star) to the Serverless Function endpoint |
| **GitHub API (REST v3 + GraphQL v4)** | Source | Queried exclusively by Lambda workers — never by the serving layer |
| **Serverless Function (Lambda / Vercel)** | Ingestion | Receives webhook POST, verifies HMAC-SHA256 signature, enqueues payload to SQS. Returns `200 OK` to GitHub in < 1s. Scales to zero when idle. |
| **Amazon EventBridge** | Ingestion | Serverless cron rule (`0 */6 * * ? *`) that fires every 6 hours to trigger the Serverless Function for an incremental sweep — catches any events missed by webhook delivery failures. |
| **Amazon SQS / Upstash Kafka** | Queue | Decouples ingestion from processing. Absorbs burst traffic. Native DLQ and exponential-backoff retry. Visibility timeout prevents duplicate processing. |
| **Lambda Workers (×4)** | Processing | Each SQS message triggers one worker. Fetches only the changed data domain from GitHub (with ETag conditional request). Upserts result into MongoDB. Invalidates the affected Redis cache key. |
| **Dead Letter Queue** | Processing | Receives messages that have exhausted all retries. Triggers an alert; messages are replayed manually or on the next cron cycle. |
| **MongoDB** | Storage | Ground-truth persistent store for all repository data, contributor lists, language breakdowns, and sync audit logs |
| **Redis** | Storage | Dual-purpose: HTTP response cache (TTL per data type) and shared rate-limit budget tracker across all worker invocations |
| **NestJS REST API** | Serving | `GET /api/repositories`, `GET /api/repositories/:owner/:name` — reads from Redis then MongoDB. Never calls GitHub. |
| **NestJS GraphQL API** | Serving | Flexible field-selection queries for the Angular frontend. Reduces over-fetching across 300+ repo cards. |
| **Cache Interceptor** | Serving | Sits in front of all NestJS endpoints. On cache miss: queries MongoDB, populates Redis, returns data. During GitHub outage: serves stale data with `X-Data-Stale: true` header. |
| **Angular 17 SPA** | Frontend | Consumes the NestJS serving layer exclusively. Never calls GitHub directly. SSR on first load; PWA cache for repeat visits. |

---

## The Two Flows Side-by-Side

```
INGESTION FLOW  (serverless, event-driven, scales to zero)
──────────────────────────────────────────────────────────
GitHub Event
    └─► Serverless Function  (verify HMAC, enqueue)
            └─► Amazon SQS   (buffer, retry, DLQ)
                    └─► Lambda Worker  (fetch from GitHub API w/ ETag)
                                └─► MongoDB  (upsert)
                                └─► Redis    (cache invalidate)

SERVING FLOW  (NestJS, always-on, consistent low latency)
──────────────────────────────────────────────────────────
Frontend GET /api/repositories
    └─► NestJS Cache Interceptor
            ├─► Redis HIT  → return immediately  (~5ms)
            └─► Redis MISS → MongoDB query
                                └─► populate Redis (TTL)
                                └─► return to frontend
```

---

## Cache TTL Policy

| Data Type | Redis TTL | Rationale |
|-----------|-----------|-----------|
| Repository list (all repos) | 5 minutes | Balance freshness vs. read load |
| Single repo detail | 2 minutes | Changed more frequently |
| Contributors | 1 hour | Slow-moving data |
| Languages | 6 hours | Very slow-moving data |
| Rate-limit budget tracker | Until reset window | Shared across all worker invocations |

---

## Scaling: 300 → 10,000 Repositories

```mermaid
graph LR
    subgraph "300 repos — current"
        A1[Single Lambda function]
        A2[SQS standard queue]
        A3[4 Lambda workers]
        A4[1 MongoDB node]
        A5[1 Redis node]
        A6[Single NestJS pod]
    end

    subgraph "10,000 repos — scaled"
        B1[Lambda auto-scales<br/>to burst concurrency]
        B2[SQS — no scaling needed<br/>fully managed]
        B3[Lambda workers scale<br/>with queue depth]
        B4[MongoDB Replica Set<br/>+ read replicas]
        B5[Redis Cluster<br/>partitioned by org]
        B6[NestJS pods — Kubernetes HPA<br/>scaled on CPU + request rate]
        B7[CDN<br/>for static public data]
    end
```

| Concern | 300 repos | 10,000 repos |
|---------|-----------|--------------|
| Webhook burst handling | Lambda single invocation | Lambda scales to thousands of concurrent invocations automatically |
| Queue throughput | SQS standard queue | SQS FIFO per org — no config change needed |
| Worker throughput | 4 worker functions | Lambda concurrency scales linearly with queue depth |
| GitHub rate limits | PAT token pool | Migrate to GitHub App — 15,000 req/hr per installation |
| Database reads | Single MongoDB node | Replica Set + read replicas; NestJS API reads from secondaries |
| Cache capacity | Single Redis node | Redis Cluster with consistent hashing, partitioned by org |
| API throughput | Single NestJS pod | Kubernetes HPA — scale NestJS pods on CPU/request rate |
| Cold start (new org) | — | Backfill pipeline: GraphQL `nodes` query, 100 repos per request |