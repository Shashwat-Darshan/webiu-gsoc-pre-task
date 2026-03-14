# Architecture Diagram — Scalable GitHub Data Aggregation System

## System Architecture (Mermaid)

```mermaid
graph TB
    subgraph Sources["Data Sources"]
        GH[GitHub API<br/>REST v3 + GraphQL v4]
        WH[GitHub Webhooks]
    end

    subgraph Ingestion["Ingestion Layer"]
        WHL[Webhook Handler<br/>NestJS Controller]
        SCHED[Cron Scheduler<br/>@nestjs/schedule]
        INGEST[Ingestion Service<br/>Token Pool + ETag Cache]
    end

    subgraph Queue["Processing Queue"]
        MQ[Bull/BullMQ<br/>Redis-backed Job Queue]
    end

    subgraph Processing["Processing Layer"]
        W1[Worker — Repo Metadata]
        W2[Worker — Contributors]
        W3[Worker — Languages]
        W4[Worker — Issues / PRs]
        DLQ[Dead Letter Queue<br/>Failed Jobs]
    end

    subgraph Storage["Storage Layer"]
        MONGO[(MongoDB<br/>Persistent Store)]
        REDIS[(Redis<br/>Cache + Queue)]
    end

    subgraph API["API Layer"]
        REST[REST API<br/>NestJS Controllers]
        GQL[GraphQL API<br/>NestJS Apollo]
        CACHE[Cache Interceptor<br/>Redis TTL]
    end

    subgraph Frontend["Frontend"]
        UI[Angular 17 SPA<br/>SSR + PWA]
    end

    GH -->|Polled / batch fetch| INGEST
    WH -->|Realtime push events| WHL
    WHL --> MQ
    SCHED -->|Every 6 hrs| INGEST
    INGEST --> MQ

    MQ --> W1
    MQ --> W2
    MQ --> W3
    MQ --> W4
    W1 & W2 & W3 & W4 -->|On failure| DLQ
    W1 & W2 & W3 & W4 --> MONGO
    W1 & W2 & W3 & W4 --> REDIS

    REST --> CACHE
    GQL --> CACHE
    CACHE -->|Cache hit| UI
    CACHE -->|Cache miss| MONGO
    MONGO -->|Populate cache| CACHE

    UI --> REST
    UI --> GQL
```

## Component Responsibilities

| Component | Role |
|-----------|------|
| **Webhook Handler** | Receives GitHub push/release/star/issue events in real-time; enqueues targeted repo update jobs |
| **Cron Scheduler** | Periodic full-sweep fallback (every 6 h) for repos with no webhook; incremental sync using `since` param |
| **Ingestion Service** | Owns token pool rotation, ETag-based conditional requests, rate-limit budget tracking |
| **Bull Queue** | Decouples ingestion from processing; provides retry, concurrency control, and backpressure |
| **Workers (x4)** | Each worker handles one data domain (metadata / contributors / languages / issues) in parallel |
| **Dead Letter Queue** | Permanently failed jobs are stored, alerted, and retried manually or on next cycle |
| **MongoDB** | Ground-truth persistent store — all repo data, history, analytics |
| **Redis** | Dual-purpose: job queue backend + HTTP response cache with TTL |
| **NestJS API** | REST + GraphQL endpoints consumed by the Angular frontend |
| **Cache Interceptor** | Serves stale data during GitHub outages; TTL tuned per data freshness requirements |

## Scaling from 300 → 10,000 Repos

```mermaid
graph LR
    subgraph "300 repos (current)"
        S1[Single NestJS instance]
        S2[1 Redis node]
        S3[1 MongoDB node]
    end

    subgraph "10,000 repos (scaled)"
        T1[Horizontally scaled<br/>NestJS pods — Kubernetes]
        T2[Redis Cluster<br/>partitioned by org]
        T3[MongoDB Replica Set<br/>+ read replicas]
        T4[Worker pool<br/>auto-scaled by queue depth]
        T5[CDN<br/>for static/public data]
    end
```
