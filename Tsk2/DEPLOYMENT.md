# Deployment Guide — GitHub Repository Intelligence Analyzer

## Architecture

```
┌─────────────────────────────────────┐
│  FastAPI Backend (Railway)           │
│  - POST /analyze                     │
│  - GET  /health                      │
│  - GET  /docs  ← Swagger UI          │
└─────────────────────────────────────┘
```

The backend exposes a full **Swagger UI at `/docs`** — no separate frontend is
required to interact with the tool. Mentors and reviewers can submit repositories
and view scored results directly from the browser.

---

## Backend → Railway

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**.
2. Select this repository.
3. Set **Root Directory** to `Tsk2/backend`.
4. Add environment variable: `GITHUB_TOKEN = <your PAT>`.
5. Railway detects the `Dockerfile` and builds automatically.
6. Copy the generated URL (e.g., `https://gh-analyzer.up.railway.app`).
7. Paste the live URL into `Tsk2/README.md` under **Live URL**.

---

## Local Development

### Prerequisites
- Python 3.11+
- GitHub Personal Access Token (optional but recommended — raises limit: 60 → 5,000 req/hr)

### Run the backend

```bash
cd Tsk2/backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # add your GITHUB_TOKEN
uvicorn main:app --reload --port 8000
```

| Endpoint | URL |
|----------|-----|
| Swagger UI | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |
| Analyze API | http://localhost:8000/analyze |

### Quick test with curl

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repos": [
      "https://github.com/nestjs/nest",
      "https://github.com/c2siorg/Webiu"
    ]
  }' | python -m json.tool
```

---

## Docker (local)

```bash
cd Tsk2
docker-compose up --build
```

Backend available at **http://localhost:8000**

---

## CORS

The FastAPI backend has `allow_origins=["*"]` for development.
Before finalising, replace `"*"` with your exact deployed domain:

```python
# backend/main.py
allow_origins=["https://your-project.vercel.app"],
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | Recommended | GitHub PAT — raises rate limit from 60 to 5,000 req/hr |

Copy `.env.example` to `.env` and fill in the value:

```
GITHUB_TOKEN=ghp_your_token_here
```
