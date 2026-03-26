# Task 2 - GitHub Repository Intelligence Analyzer

This project analyzes GitHub repositories and estimates newcomer onboarding difficulty.

## Current Backend Model

- Runtime: Node.js + Express + TypeScript
- Collector: Octokit GitHub REST client
- Core model: Confidence-weighted classifier (Model B, default)
- Alternate model scaffold: Rules-based classifier (Model A)

## API Endpoints

- `POST /analyze`
- `GET /health`

## Request

```json
{
  "repos": [
    "https://github.com/nestjs/nest",
    "https://github.com/c2siorg/Webiu"
  ],
  "github_token": "optional"
}
```

## Response Additions (New)

Each repository response now includes:

- `issue_closure_rate`
- `confidence_score`
- `onboarding_health_score`
- `model_version`
- `explainability`:
  - `rationale`
  - `top_positive_drivers[]`
  - `top_friction_drivers[]`

`data_quality` now supports:

- `complete`
- `partial`
- `partial_search`
- `partial_tree`
- `degraded`
- `unavailable`

## Scoring Highlights

1. Scale, Friction, and Welcomingness are computed separately.
2. Scale uses power-law normalization (`log10`) to reduce popularity bias.
3. Friction uses filtered tree metrics to avoid vendor/build/docs noise inflation.
4. Welcomingness uses Community Health + fresh good-first-issue count + issue closure ratio.
5. Final difficulty is derived from advanced probability with guardrails:
   - Beginner if `P(Advanced) < 0.35`, unless stale (`days_since_last_commit > 90`)
   - Intermediate if `0.35 <= P(Advanced) <= 0.70`
   - Advanced if `P(Advanced) > 0.70`

See `SCORING.md` for formulas and assumptions.

## Local Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Default ports:

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:5173`

## Notes

- Search API and tree retrieval have fallback-safe behavior.
- Large repositories can trigger tree fallback heuristics to avoid timeout/memory pressure.
- Community profile or search failures degrade gracefully via data quality flags.
