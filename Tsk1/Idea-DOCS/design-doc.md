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

**Scheduled Jobs (fallback)**  
For repositories where webhooks cannot be registered (e.g., external forks, orgs with
restricted webhook access), a cron job runs a full incremental sweep every 6 hours.
It uses the `updated_at` field from GitHub's repo list endpoint to identify which
repos have changed since the last run and enqueues only those — not all 300.

### 2. Processing Layer

Ingestion and processing are decoupled via **Bull/BullMQ** (Redis-backed message queue).

- Each repo update becomes one or more typed jobs (metadata, contributors, languages, issues).
- Workers process jobs concurrently up to a configurable concurrency limit.
- Jobs have automatic retry with **exponential backoff** (3 attempts, 2 s / 8 s / 32 s delays).
- A **Dead Letter Queue** captures permanently failed jobs for alerting and manual replay.

Parallel worker domains (each independently restartable):

| Worker | Data Domain | Frequency |
|--------|-------------|-----------|
| `repo-metadata` | stars, forks, topics, description, homepage | Every webhook / cron |
| `repo-contributors` | top contributors, contributor count | Weekly |
| `repo-languages` | language percentages | On push |
| `repo-issues` | open/closed issue count, PR stats | Every webhook / daily |

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
1. **Job queue backend** — Bull persists jobs, retries, and results here.
2. **HTTP response cache** — API responses cached with TTLs matched to data volatility.

| Data type | Cache TTL |
|-----------|-----------|
| Repository list (all repos) | 5 minutes |
| Single repo details | 2 minutes |
| Contributors | 1 hour |
| Languages | 6 hours |

### 4. API Layer

The NestJS server exposes dual interfaces:

- **REST API** — standard CRUD-friendly endpoints for simple consumers.
- **GraphQL API** — flexible queries for the Angular frontend to request exactly the
  fields it needs per page/component (reduces over-fetching).

A **Cache Interceptor** sits in front of both. On a miss it queries MongoDB, populates
the cache, and returns data. During a GitHub outage, stale cached data is served with
an `X-Data-Stale: true` header so the frontend can show an appropriate notice.

---

## Rate Limit Handling

| Strategy | Detail |
|----------|--------|
| **Token Pool** | Maintain a pool of 3–5 GitHub personal access tokens; round-robin assign tokens to requests to multiply the effective rate limit |
| **ETag Conditional Requests** | Store the ETag returned by GitHub per resource; send `If-None-Match` on next request — a 304 Not Modified costs 1 API point but returns no data, preserving bandwidth and rate budget |
| **GraphQL Batching** | Use GitHub GraphQL API to fetch multiple repos' metadata in one query (up to 100 nodes per query vs 1 per REST call) |
| **Incremental Sync** | Use `?since=` and `updated_at` to only fetch repos that changed — not the full list every cycle |
| **Rate-Limit Budget Tracker** | Monitor `X-RateLimit-Remaining` headers; if below threshold (e.g., < 200), pause new ingestion jobs and resume when the window resets |

---

## Update Mechanism

```
GitHub event occurs  →  Webhook POST to /webhooks/github
                     →  Verify HMAC-SHA256 signature
                     →  Parse event type + repo identifier
                     →  Enqueue targeted update job
                     →  Worker fetches only changed data
                     →  MongoDB updated, cache invalidated
```

Cron fallback (every 6 h):
```
GET /repos?org=c2siorg&sort=updated&per_page=100
Filter: repos where updated_at > last_synced_at
Enqueue only changed repos
```

---

## Failure Handling

| Failure Type | Handling |
|-------------|---------|
| GitHub API 429 (rate limit) | Respect `Retry-After` header; pause token and resume; serve stale cache |
| GitHub API 5xx | Retry with exponential backoff (3×); move to DLQ after max retries |
| Unavailable repo (404) | Mark repo as `archived/deleted` in DB; surface gracefully on frontend |
| Redis cache down | Fall through to MongoDB; log degraded-mode metric |
| MongoDB down | Fall through to Redis cache; if both down, return 503 with user-friendly message |
| Webhook signature invalid | Reject with 401; log for security review |

---

## Scalability Plan (300 → 10,000 repositories)

| Concern | Solution |
|---------|---------|
| API throughput | Horizontal NestJS pod scaling behind a load balancer (Kubernetes HPA) |
| Queue throughput | Increase Bull worker concurrency; add more worker replicas scaled to queue depth |
| GitHub rate limits | Add more tokens to pool; migrate fully to GitHub App auth (higher quota: 15,000 req/hr per installation) |
| Database reads | MongoDB read replicas; indexes on `owner`, `name`, `updatedAt`, `stars` |
| Cache capacity | Redis Cluster with consistent hashing; partition by org |
| Webhook volume | Move webhook handler to a separate microservice with its own scaling |
| Cold start (new org) | Backfill pipeline: batch-fetch all repos using GraphQL `nodes` query, 100 per request |
