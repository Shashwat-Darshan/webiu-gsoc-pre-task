# Task 2 — GitHub Repository Intelligence Analyzer

## What this tool does

Accepts a list of GitHub repository URLs, fetches live data from the GitHub API, and
generates a structured intelligence report for each repository containing:

- **Activity Score** (0–100) — how actively maintained the repo is right now
- **Complexity Score** (0–100) — how large and multi-layered the codebase is
- **Learning Difficulty** — `Beginner` / `Intermediate` / `Advanced` classification
- Human-readable notes explaining every score

---

## Deliverables checklist

- [x] [Scoring formulas + assumptions](./SCORING.md)
- [x] [Backend source code](./backend/)
- [x] [Sample outputs](./sample-outputs/) — 5 repos analyzed
- [x] [Deployment guide](./DEPLOYMENT.md)
- [x] [UI contract](./UI_CONTRACT.md) — types, API spec, component map
- [ ] Live URL — _filled after deployment_

---

## Technology Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Backend** | **FastAPI (Python)** | Ideal for data-analysis tools; auto-generates Swagger UI at `/docs`; `httpx` async client for concurrent GitHub fetches; deploys in one push to Railway/Render |
| **Cache** | `cachetools.TTLCache` (in-process) | No extra infrastructure needed for a standalone tool; 1-hour TTL per repo endpoint |
| **Deployment** | Railway (backend) | Git-push deploy; free tier; environment variable UI; auto HTTPS |

> **Why FastAPI instead of NestJS for this task?**
> Task 2 is a standalone analysis tool, not an extension of Webiu. FastAPI's automatic
> `/docs` UI lets mentors interact with the API without any frontend setup. Python's
> data ecosystem is more ergonomic than TypeScript for formula-heavy scoring work.
> NestJS is the right choice for the main Webiu backend (Task 1).

---

## API Specification

### Base URL
```
http://localhost:8000          (local)
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
        "Very high commit frequency (312 commits in 90 days)",
        "Large contributor base (450 contributors)",
        "Deep folder structure (max depth 7)"
      ],
      "data_quality": "complete"
    }
  ]
}
```

**Error response** (missing / private repo):
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
```json
{ "status": "ok", "version": "1.0.0" }
```

#### `GET /docs`
Auto-generated Swagger UI — interact with the API directly in the browser (FastAPI built-in).

---

## Setup Instructions

### Prerequisites
- Python 3.11+
- GitHub Personal Access Token (optional but recommended — raises rate limit from 60 → 5,000 req/hr)

### Run locally

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add GITHUB_TOKEN=your_pat_here
uvicorn main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Swagger UI: `http://localhost:8000/docs`

### Run with Docker

```bash
# from Tsk2/
docker-compose up --build
```

- API: `http://localhost:8000`

---

## Project Structure

```
Tsk2/
├── backend/
│   ├── main.py            # FastAPI app — /analyze and /health endpoints
│   ├── github_client.py   # Async GitHub API fetcher with TTL cache + rate-limit guard
│   ├── scorer.py          # Activity score, complexity score, difficulty classifier, notes
│   ├── models.py          # Pydantic request / response schemas
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── sample-outputs/        # JSON reports for 5 analyzed repositories
├── SCORING.md             # Full formula documentation
├── UI_CONTRACT.md         # Frontend types, API contract, component map
├── DEPLOYMENT.md          # Railway deployment guide
└── docker-compose.yml
```

---

## Quick test (curl)

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repos": [
      "https://github.com/c2siorg/Webiu",
      "https://github.com/nestjs/nest"
    ]
  }'
```

See [sample-outputs/](./sample-outputs/) for pre-generated reports on five repositories.