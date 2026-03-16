# API Flow — GitHub Data Aggregation System

## Frontend → Backend Request Lifecycle

```mermaid
sequenceDiagram
    participant Browser as Angular Frontend
    participant API as NestJS API Server
    participant Cache as Redis Cache
    participant DB as MongoDB
    participant GH as GitHub API

    %% Happy path — cache hit
    Browser->>API: GET /api/repositories?org=c2siorg
    API->>Cache: GET cache key "repos:c2siorg:list"
    Cache-->>API: HIT — return JSON (TTL 5min)
    API-->>Browser: 200 OK [cached]

    %% Cache miss — DB hit
    Browser->>API: GET /api/repositories/nestjs/nest
    API->>Cache: GET cache key "repo:nestjs/nest"
    Cache-->>API: MISS
    API->>DB: findOne({ owner:"nestjs", name:"nest" })
    DB-->>API: Repository document
    API->>Cache: SET "repo:nestjs/nest" TTL 120s
    API-->>Browser: 200 OK [db]

    %% Stale data during GitHub outage
    Browser->>API: GET /api/repositories/nestjs/nest
    Note over API: GitHub unreachable, cache expired
    API->>Cache: GET cache key (expired, but stale-while-revalidate)
    Cache-->>API: Stale data returned
    API-->>Browser: 200 OK + X-Data-Stale: true header
```

## Webhook Ingestion Flow

```mermaid
sequenceDiagram
    participant GH as GitHub
    participant FN as Serverless Function<br/>(Lambda / Vercel)
    participant SQS as Amazon SQS
    participant W as Lambda Worker
    participant DB as MongoDB
    participant Cache as Redis Cache

    GH->>FN: POST /webhooks/github (push event)
    FN->>FN: Verify HMAC-SHA256 signature
    FN->>SQS: Enqueue payload { type:"repo-metadata", repo:"c2siorg/Webiu" }
    FN-->>GH: 200 OK (fast ack, < 1s — no blocking)

    SQS->>W: Trigger Lambda Worker (SQS message)
    W->>GH: GET /repos/c2siorg/Webiu (with ETag)
    alt 200 OK (data changed)
        GH-->>W: Updated repo data
        W->>DB: upsert repository document
        W->>Cache: DEL "repo:c2siorg/Webiu" (invalidate)
    else 304 Not Modified
        GH-->>W: No body (0 rate-limit points used)
        W->>W: No DB write needed — skip upsert
    end
```

## Cron Reconciliation Flow (EventBridge)

```mermaid
sequenceDiagram
    participant EB as Amazon EventBridge
    participant FN as Serverless Function
    participant SQS as Amazon SQS
    participant GH as GitHub API
    participant DB as MongoDB

    EB->>FN: Trigger rule: 0 */6 * * ? * (Every 6h)
    FN->>DB: GET /syncJobs/last (Get last_synced_at timestamp)
    DB-->>FN: last_synced_at = "2026-03-10T00:00:00Z"
    
    FN->>GH: GET /orgs/c2siorg/repos?sort=updated
    GH-->>FN: List of repositories
    
    FN->>FN: Filter repos where updated_at > last_synced_at
    FN->>SQS: Enqueue payloads for changed repos only
    FN->>DB: Update last_synced_at timestamp
```

## REST API Endpoints

### `GET /api/repositories`
Returns paginated list of all tracked repositories.

**Query params**: `org`, `page`, `limit`, `sort` (stars|updated|name), `language`, `topic`

**Response**:
```json
{
  "data": [
    {
      "id": "...",
      "owner": "c2siorg",
      "name": "Webiu",
      "description": "...",
      "stars": 120,
      "forks": 45,
      "primaryLanguage": "TypeScript",
      "topics": ["angular", "nestjs", "gsoc"],
      "updatedAt": "2026-03-10T08:00:00Z",
      "syncedAt": "2026-03-12T06:00:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 314 }
}
```

### `GET /api/repositories/:owner/:name`
Returns full details for a single repository.

**Response**:
```json
{
  "owner": "c2siorg",
  "name": "Webiu",
  "stars": 120,
  "forks": 45,
  "openIssues": 12,
  "languages": { "TypeScript": 78.4, "SCSS": 14.2, "HTML": 7.4 },
  "contributors": [
    { "login": "user1", "avatarUrl": "...", "contributions": 234 }
  ],
  "topics": ["angular", "nestjs"],
  "homepage": "https://webiu.c2si.ai",
  "lastCommitAt": "2026-03-10T08:00:00Z"
}
```

### `POST /webhooks/github`
Serverless Function endpoint (AWS Lambda / Vercel). Verifies HMAC-SHA256 signature
and enqueues a typed payload into Amazon SQS. Returns `200 OK` to GitHub in < 1s.
Invalid signatures are rejected with `401` before the payload reaches the queue.

**Headers**: `X-GitHub-Event`, `X-Hub-Signature-256`

### `GET /api/health`
Returns service health and cache/DB status.

## GraphQL Schema (subset)

```graphql
type Repository {
  id: ID!
  owner: String!
  name: String!
  description: String
  stars: Int!
  forks: Int!
  primaryLanguage: String
  languages: JSON
  topics: [String!]
  contributors(limit: Int = 10): [Contributor!]
  openIssues: Int!
  updatedAt: DateTime!
}

type Contributor {
  login: String!
  avatarUrl: String!
  contributions: Int!
  profileUrl: String!
}

type Query {
  repositories(org: String, language: String, topic: String, limit: Int, offset: Int): [Repository!]!
  repository(owner: String!, name: String!): Repository
}

type Subscription {
  repositoryUpdated(owner: String!, name: String!): Repository!
}
```

The Angular frontend subscribes to `repositoryUpdated` to show live updates without polling.
