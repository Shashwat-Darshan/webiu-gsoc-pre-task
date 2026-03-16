# Design Explanation — Scalable GitHub Data Aggregation System

## Problem Statement

An organization manages **300+ GitHub repositories**. A public website must display
up-to-date project information for all of them. The naive approach — proxying live
GitHub API calls per page load — immediately fails: GitHub's REST API rate limit is
5,000 requests/hour per token, and GraphQL is 5,000 points/hour. Fetching 300 repos'
worth of data on demand is both slow and rate-limit hostile. The system described here
solves that with an asynchronous data pipeline, persistent storage, and multi-layer
caching.

---

## Core Components

### 1. Data Ingestion Layer

Two complementary ingestion triggers are used:

**Webhooks (primary)**  
GitHub sends an HTTP POST to our endpoint whenever a registered event occurs
(push, release, issues, stars, fork). This gives near-real-time updates with zero
polling cost. Each incoming event payload contains enough context to enqueue only the
affected repository for refresh — no full sweep needed.

**Scheduled Reconciliation — Amazon EventBridge (fallback)**  
An **Amazon EventBridge Scheduler** rule (`cron(0 */6 * * ? *)`) triggers a Lambda function invocation every 6 hours. No always-on server is required — the rule fires the same Lambda used for webhook processing, which then queries GitHub's repo list, filters by `updated_at > last_synced_at`, and enqueues only changed repos into SQS. This is the reconciliation path for any webhooks that failed to deliver.

### 2. Processing Layer

Ingestion and processing are fully decoupled via **Amazon SQS / Upstash Kafka** (managed serverless queue) and **Serverless Workers** (AWS Lambda functions triggered by SQS messages).

- The Serverless Function (webhook receiver) enqueues a typed payload and immediately returns `200 OK` to GitHub — no synchronous processing on the hot path.
- Each SQS message triggers exactly one Lambda worker invocation — no concurrency configuration needed; scales automatically with queue depth.
- SQS provides native **exponential-backoff retry** (up to configurable max attempts) and a **Dead Letter Queue** for permanently failed messages — no custom retry logic required.
- Each worker fetches only its specific data domain from the GitHub GraphQL API using **ETag conditional requests** — if the data hasn't changed, GitHub returns `304 Not Modified` at zero rate-limit cost.

Parallel worker domains (each independently deployable and restartable):

| Lambda Worker | Data Domain | Trigger Frequency |
|--------|-------------|-----------|
| `worker-metadata` | stars, forks, topics, description, homepage | Every webhook event / EventBridge 6h sweep |
| `worker-contributors` | top contributors, contributor count | EventBridge weekly rule |
| `worker-languages` | language percentages | On push event (webhook) |
| `worker-issues` | open/closed issue count, PR stats | Every webhook event / EventBridge daily rule |

### 3. Storage Layer

**MongoDB** is the persistent ground-truth store. Schema design:

```
repositories
  _id, owner, name, fullName, description, stars, forks,
  topics[], languages{}, contributors[], openIssues, closedIssues,
  lastCommitAt, updatedAt, createdAt, syncedAt, webhookActive

syncJobs (audit log)
  repoId, trigger (webhook|cron), status, startedAt, completedAt, error
```

All data that changes infrequently (topics, languages, contributors) is stored
persistently. Data that is almost real-time (exact star count) is fetched fresh only
when explicitly requested by the user, not on every page load.

**Redis** is used for two distinct purposes:
1. **HTTP response cache** — NestJS API responses cached with TTLs matched to data volatility.
2. **Rate-limit budget tracker** — shared store for `X-RateLimit-Remaining` values, readable across all Lambda worker invocations to prevent rate-limit exhaustion.

| Data type | Cache TTL |
|-----------|-----------|
| Repository list (all repos) | 5 minutes |
| Single repo details | 2 minutes |
| Contributors | 1 hour |
| Languages | 6 hours |

### 4. API Layer

The NestJS server is **serving-only** — it reads exclusively from MongoDB and Redis and never calls the GitHub API directly. It exposes dual interfaces:

- **REST API** — `GET /api/repositories`, `GET /api/repositories/:owner/:name`, and health/metrics endpoints.
- **GraphQL API** — flexible field-selection queries for the Angular frontend, eliminating over-fetching across 300+ repo cards.

A **Cache Interceptor** sits in front of both. On a miss it queries MongoDB, populates Redis with an appropriate TTL, and returns data. During a GitHub outage the ingestion layer pauses (SQS retries), but the NestJS API continues serving the last known good snapshot with an `X-Data-Stale: true` header — 100% frontend uptime regardless of GitHub availability.

---

## Rate Limit Handling

| Strategy | Detail |
|----------|--------|
| **Webhook-First Ingestion** | GitHub pushes updates to the Serverless Function — zero polling cost for real-time events |
| **ETag Conditional Requests** | Lambda workers store the ETag returned by GitHub per resource and send `If-None-Match` on the next fetch — a `304 Not Modified` costs 0 rate-limit points and skips the DB write entirely |
| **GraphQL Batching** | Workers use GitHub GraphQL v4 to batch up to 100 repo metadata nodes per request vs 1 per REST call — reduces a full sweep of 300 repos from ~1,200 calls to ~10–15 |
| **Incremental Sync** | The cron trigger uses `updated_at` to enqueue only repos that changed since the last sweep — not all 300+ every 6 hours |
| **Shared Rate-Limit Budget Tracker** | Each Lambda worker writes `X-RateLimit-Remaining` to Redis after every GitHub call. If the shared counter drops below threshold (e.g., < 200), workers stop dequeuing and wait for the reset window |

---

## Update Mechanism

```
GitHub event occurs
    └─► POST to Serverless Function endpoint
            └─► Verify HMAC-SHA256 signature  (reject 401 if invalid)
            └─► Enqueue typed payload → Amazon SQS
            └─► Return 200 OK to GitHub  (< 1s, no blocking)

SQS message visible
    └─► Trigger Lambda Worker
            └─► Fetch changed data from GitHub API  (ETag conditional)
            └─► Upsert document → MongoDB
            └─► Invalidate Redis cache key for affected repo
```

Cron reconciliation fallback (every 6 h):
```
Amazon EventBridge rule fires (cron: 0 */6 * * ? *)
    └─► Lambda Function (Reconciliation) calls GitHub list endpoint
            └─► GET /orgs/c2siorg/repos?sort=updated&per_page=100
            └─► Filter: repos where updated_at > last_synced_at
            └─► Enqueue only changed repos → SQS
```

---

## Failure Handling

| Failure Type | Handling |
|-------------|---------|
| GitHub API 429 (rate limit) | Lambda worker respects `Retry-After` header; SQS message becomes invisible (visibility timeout) and is retried automatically; NestJS serving layer continues with stale cache |
| GitHub API 5xx | SQS retries with native exponential backoff (configurable attempts); message moves to DLQ after max retries; alert fires for manual replay |
| Unavailable repo (404) | Lambda worker marks repo as `archived/deleted` in MongoDB; NestJS API surfaces the status to the frontend gracefully |
| Redis cache down | NestJS API falls through to MongoDB; logs degraded-mode metric; Lambda workers skip cache invalidation step silently |
| MongoDB down | NestJS API falls through to Redis stale cache; if both unavailable, returns `503` with user-friendly message |
| Webhook signature invalid | Serverless Function rejects with `401` before enqueuing — invalid payload never reaches SQS or workers |
| SQS / queue unavailable | Serverless Function retries enqueue with exponential backoff; if queue is still unavailable, logs the raw payload to CloudWatch for manual replay |

---

## Scalability Plan (300 → 10,000 repositories)

| Concern | 300 repos → 10,000 repos solution |
|---------|---------|
| Webhook burst volume | Serverless Function auto-scales to thousands of concurrent invocations — no pre-provisioning, no separate microservice needed |
| Queue throughput | SQS is fully managed; scales automatically; switch to SQS FIFO per org for ordering guarantees |
| Worker throughput | Lambda workers scale linearly with SQS queue depth — each message triggers one invocation |
| GitHub rate limits | Migrate to GitHub App auth: 15,000 req/hr per installation vs 5,000 for PATs |
| Database reads | MongoDB Replica Set + read replicas; NestJS API reads from secondaries; indexes on `owner`, `name`, `updatedAt`, `stars` |
| Cache capacity | Redis Cluster with consistent hashing; partition by org |
| NestJS API throughput | Kubernetes HPA — scale NestJS pods on CPU and request rate |
| Cold start (new org) | Backfill pipeline: GraphQL `nodes` query, 100 repos per request, enqueued in batches to SQS |
