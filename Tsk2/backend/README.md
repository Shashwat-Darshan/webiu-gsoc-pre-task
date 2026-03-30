## GitHub Repository Intelligence Analyzer — Backend

Quick-start for the Express/TypeScript backend that powers the repo analyzer.

### Prerequisites
- Node.js 18+
- npm
- (Recommended) GitHub Personal Access Token to raise API limits.

### Setup and run locally
```bash
npm install
cp .env.example .env
npm run dev
```

### Build
```bash
npm run build
```

### Environment
- `GITHUB_TOKEN` (recommended): increases GitHub rate limits from 60 → 5000 req/hour.
- Optional tuning: `PORT`, `GITHUB_REQUEST_TIMEOUT_MS`, `GITHUB_CONCURRENCY_LIMIT`, `GITHUB_RATE_LIMIT_STOP_THRESHOLD`.

### Endpoints
- `GET /health`
- `POST /analyze`

### Serverless targets
- Vercel: `api/index.ts`
- AWS Lambda bundle: `dist/serverless/lambda.js`
