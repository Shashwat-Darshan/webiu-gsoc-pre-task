# Deployment Guide — GitHub Repository Intelligence Analyzer

## Architecture

This backend supports two runtime modes:

1. Local development as an Express server (`src/server.ts`)
2. Serverless deployment via function entrypoints:
   - AWS Lambda handler at `src/serverless/lambda.ts`
   - Vercel function entrypoint at `api/index.ts`

Endpoints are identical in both modes:

- `POST /analyze`
- `GET /health`

---

## Local Development

### Prerequisites

- Node.js 18+
- npm
- GitHub Personal Access Token (optional but recommended — raises rate limit: 60 → 5,000 req/hr)

### Run locally

```bash
cd Tsk2/backend
npm install
cp .env.example .env
npm run dev
```

| Endpoint | URL |
|----------|-----|
| Health check | http://localhost:8000/health |
| Analyze API | http://localhost:8000/analyze |

### Quick test

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repos": [
      "https://github.com/nestjs/nest",
      "https://github.com/c2siorg/Webiu"
    ]
  }'
```

---

## Serverless Deployment (Vercel)

1. Import this repo in Vercel.
2. Set project root to `Tsk2/backend`.
3. Add environment variable `GITHUB_TOKEN` (recommended).
4. Deploy. Vercel will use `api/index.ts` as a serverless function.

---

## Serverless Deployment (AWS Lambda)

1. Build the project:

```bash
cd Tsk2/backend
npm install
npm run build
```

2. Use `dist/serverless/lambda.js` as your Lambda handler bundle entrypoint.
3. Configure API Gateway routes for `POST /analyze` and `GET /health`.

---

## Docker (local)

```bash
cd Tsk2
docker-compose up --build
```

Backend available at **http://localhost:8000**

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Optional | Local HTTP port (default: `8000`) |
| `GITHUB_TOKEN` | Recommended | GitHub PAT to increase API budget |
| `GITHUB_REQUEST_TIMEOUT_MS` | Optional | GitHub request timeout in milliseconds |
| `GITHUB_CONCURRENCY_LIMIT` | Optional | Max parallel GitHub API requests |
| `GITHUB_RATE_LIMIT_STOP_THRESHOLD` | Optional | Stop threshold for remaining rate-limit budget |
