# Proof of Work — Task 2

This document is designed for GSoC proposal evidence.

## 1. What was implemented

- Backend analyzer API (Node.js + TypeScript)
- Structured scoring output for activity, complexity, and difficulty
- Graceful handling for invalid or unavailable repositories
- Serverless-ready entrypoints (Lambda + Vercel)
- Proposal-grade frontend dashboard (React + TypeScript)

## 2. Local run commands

### Backend

```bash
cd Tsk2/backend
npm install
npm run dev
```

Expected local endpoint:

- `http://localhost:8000/health`
- `http://localhost:8000/analyze`

### Frontend

```bash
cd Tsk2/frontend
npm install
npm run dev
```

Expected local UI:

- `http://localhost:5173`

## 3. Live demo flow for reviewers

1. Open frontend at `http://localhost:5173`.
2. Keep default repositories or add your own GitHub URLs.
3. Click **Analyze repositories**.
4. Confirm cards render with:
   - activity score
   - complexity score
   - difficulty badge
   - notes
5. Select one card and review detailed stats panel.
6. Add one invalid URL (example: `not-a-url`) and re-run.
7. Confirm graceful error handling appears in results (no crash).

## 4. Suggested screenshots for proposal

1. Input form with repositories and optional token
2. Loading state while analysis runs
3. Results grid with multiple repo cards
4. Detailed panel with notes and language distribution
5. Error case showing invalid repo handling
6. Terminal output showing backend and frontend servers running

## 5. Suggested test evidence table

| Check | Expected | Status |
|------|----------|--------|
| Backend health endpoint | `{"status":"ok","version":"1.0.0"}` | PASS |
| Analyze valid repo | Structured analysis object with scores | PASS |
| Analyze mixed input | Valid result + structured error result | PASS |
| Frontend loads | Dashboard visible at `localhost:5173` | PASS |
| Frontend to backend integration | UI renders API results on submit | PASS |

## 6. API contract evidence

Frontend uses the analyzer contract fields:

- `repo`, `url`, `stars`, `forks`, `open_issues`
- `activity_score`, `complexity_score`, `difficulty`
- `notes`, `data_quality`, optional `error`

This proves end-to-end implementation and contract alignment.
