## GitHub Repository Intelligence Analyzer — Backend

Quick-start for the Express/TypeScript backend that powers the repo analyzer.

### Prerequisites
- Node.js 18+
- npm
- (Recommended) GitHub Personal Access Token to raise API limits.

### Setup and run locally
```bash
npm install
npm run dev
```

If you create a local `.env`, set optional variables such as `GITHUB_TOKEN` and tuning values listed below.

### Build
```bash
npm run build
```

### Environment
- `GITHUB_TOKEN` (recommended): increases GitHub rate limits from 60 → 5000 req/hour.
- Optional tuning: `PORT`, `GITHUB_REQUEST_TIMEOUT_MS`, `GITHUB_CONCURRENCY_LIMIT`, `GITHUB_RATE_LIMIT_STOP_THRESHOLD`, `GITHUB_CACHE_TTL_MS`, `GITHUB_CACHE_MAX_ENTRIES`.

Caching notes:
- `GITHUB_CACHE_TTL_MS`: in-memory result cache TTL in milliseconds (default `300000`, i.e. 5 minutes).
- `GITHUB_CACHE_MAX_ENTRIES`: max cached repositories before oldest entries are evicted (default `500`).

### Endpoints
- `GET /health`
- `POST /analyze`

### Response shape highlights
- Difficulty classification + confidence score
- Explainability drivers (top positive and top friction factors)
- Data-quality state for graceful degradation scenarios

### Model docs
- Final production (implemented): `../docs/SCORING.md` (`model-b-v2`)


### Deployment & CI/CD
- **Platform:** We use Vercel for hosting the backend API.
- **CI/CD:** GitHub Actions runs lint/build quality checks; deployment is handled by Vercel integration.
- **Routing:** Vercel runtime is explicitly configured via `vercel.json` rewrites to route all traffic to `api/index.ts`.
