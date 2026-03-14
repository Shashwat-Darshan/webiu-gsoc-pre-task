# Task 2 — GitHub Repository Intelligence Analyzer

## What this tool does

Accepts a list of GitHub repository URLs, fetches data from the GitHub API, and
generates a structured intelligence report for each repository containing:

- **Activity Score** (0–100) — how actively maintained the repo is
- **Complexity Score** (0–100) — how complex the codebase is
- **Learning Difficulty** — Beginner / Intermediate / Advanced classification
- Human-readable notes explaining the scores

---

## Deliverables checklist

- [x] [Scoring Formulas + Assumptions](./SCORING.md)
- [ ] [Backend source code](./backend/)
- [ ] [Frontend source code](./frontend/)
- [ ] [Sample outputs](./sample-outputs/) — 5+ repos analyzed
- [ ] Live URL: _filled after deployment_
- [ ] Setup instructions (this file, bottom section)

---

## Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend** | **FastAPI (Python)** | Ideal for data analysis tools; auto-generates OpenAPI docs at `/docs`; `httpx` async client for concurrent GitHub fetches; deploys in seconds on Railway/Render |
| **Frontend** | **Next.js 14 (React)** | External AI tools (Cursor, v0.dev, Bolt) generate React 10× faster than Angular; server components reduce client JS; Vercel deployment is free + instant |
| **Cache** | In-process `cachetools.TTLCache` | No extra infra needed for a standalone tool; 1-hour TTL per repo |
| **Deployment (backend)** | Railway | Git-push deploy; free tier; environment variables UI; auto HTTPS |
| **Deployment (frontend)** | Vercel | Git-push deploy; free tier; Next.js native |

> **Why FastAPI instead of NestJS for this task?**  
> Task 2 is a standalone analysis tool, not an extension of Webiu. FastAPI's automatic
> `/docs` UI lets mentors interact with the API without any setup. Python's data
> ecosystem (statistics, weighting, normalization) is more ergonomic than TypeScript
> for formula-heavy work. NestJS is the right choice for the main Webiu backend (Task 1).

---

## API Specification

### Base URL
```
https://gh-analyzer.up.railway.app   (after deployment)
```

### Endpoints

#### `POST /analyze`
Analyze one or more GitHub repositories.

**Request body**:
```json
{
  "repos": [
    "https://github.com/nestjs/nest",
    "https://github.com/c2siorg/Webiu"
  ],
  "github_token": "ghp_optional_token_for_higher_rate_limit"
}
```

**Response** (`200 OK`):
```json
{
  "analyzed_at": "2026-03-12T10:00:00Z",
  "total": 2,
  "results": [
    {
      "repo": "nestjs/nest",
      "url": "https://github.com/nestjs/nest",
      "stars": 68200,
      "forks": 7700,
      "open_issues": 144,
      "primary_language": "TypeScript",
      "languages": { "TypeScript": 97.2, "JavaScript": 2.8 },
      "contributors_count": 450,
      "commits_last_90d": 312,
      "closed_issues_last_90d": 87,
      "releases_last_year": 18,
      "days_since_last_commit": 1,
      "file_count": 2840,
      "folder_depth": 7,
      "has_dependency_file": true,
      "language_count": 2,
      "activity_score": 94,
      "complexity_score": 81,
      "difficulty": "Advanced",
      "notes": [
        "Very high commit frequency",
        "Large contributor base (450)",
        "Multiple language support",
        "Deep folder structure"
      ],
      "data_quality": "complete"
    }
  ]
}
```

**Error response** (missing/private repo):
```json
{
  "repo": "owner/private-repo",
  "error": "Repository not found or private",
  "activity_score": null,
  "complexity_score": null,
  "difficulty": "Unknown",
  "data_quality": "unavailable"
}
```

#### `GET /health`
Returns service status.
```json
{ "status": "ok", "version": "1.0.0" }
```

#### `GET /docs`
Auto-generated Swagger UI (FastAPI built-in).

---

## Setup Instructions

### Prerequisites
- Python 3.11+
- Node.js 20+ (for frontend)
- GitHub Personal Access Token (optional but recommended — raises limit: 60 → 5,000 req/hr)

### Backend
```bash
cd task-2-analyzer/backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # add GITHUB_TOKEN
uvicorn main:app --reload --port 8000
```
API available at `http://localhost:8000`  
Swagger UI at `http://localhost:8000/docs`

### Frontend
```bash
cd task-2-analyzer/frontend
npm install
cp .env.example .env.local  # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```
UI available at `http://localhost:3000`

### With Docker Compose
```bash
cd task-2-analyzer
docker-compose up --build
```
