## GitHub Repository Intelligence Analyzer — Frontend

Quick-start instructions for the Vite + React app that talks to the analyzer backend.

### Prerequisites
- Node.js 18+
- npm

### Install and run
```bash
npm install
npm run dev
```

### Build and preview
```bash
npm run build
npm run preview
```

### Lint
```bash
npm run lint
```

### API endpoint
- Configure the backend base URL with `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).

### GitHub token (recommended)
- Supplying a GitHub PAT in the UI unlocks higher rate limits for analysis (60 → 5000 requests/hour). The token is optional and sent only when provided.
