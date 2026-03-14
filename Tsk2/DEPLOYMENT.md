# Deployment Guide

## Backend → Railway

1. Push `task-2-analyzer/backend/` to a GitHub repo (or the root of one).
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub.
3. Select the backend folder (set **Root Directory** to `task-2-analyzer/backend` if monorepo).
4. Add environment variable: `GITHUB_TOKEN = <your PAT>`.
5. Railway detects `Dockerfile` and builds automatically.
6. Copy the generated URL (e.g., `https://gh-analyzer.up.railway.app`).

## Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo.
2. Set **Root Directory** to `task-2-analyzer/frontend`.
3. Add environment variable: `NEXT_PUBLIC_API_URL = https://gh-analyzer.up.railway.app`.
4. Deploy. Vercel auto-detects Next.js.
5. Copy the Vercel URL and add it to the submission README.

## CORS

The FastAPI backend has `allow_origins=["*"]` for now.
Before finalizing, replace `"*"` with your exact Vercel domain:

```python
# main.py
allow_origins=["https://your-project.vercel.app"],
```

## Alternative: Single Vercel Deployment (API Routes)

If you want everything on one domain, convert the FastAPI backend to **Next.js API routes**
(`/app/api/analyze/route.ts`). This eliminates the Railway backend entirely, runs on
Vercel Edge Functions, and gives you one URL. The trade-off: Python scoring logic must
be rewritten in TypeScript (or called via a serverless Python function with Vercel's
Python runtime).

Recommendation for submission: **Railway + Vercel** (simpler, works now).
