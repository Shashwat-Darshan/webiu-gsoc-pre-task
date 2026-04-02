# Pre-GSoC Submission — c2siorg / Webiu 2026

> **Author:** Shashwat Darshan · [@Shashwat-Darshan](https://github.com/Shashwat-Darshan)
> **Submitted:** March 2026

---

## Tasks at a Glance

| # | Task | Status | Type |
|---|------|--------|------|
| 1 | [Scalable GitHub Data Aggregation System](./Tsk1/README.md) | ✅ Complete | Design |
| 2 | [GitHub Repository Intelligence Analyzer](./Tsk2/README.md) | ✅ Deployed | Implementation |

---

## Task 1 — Scalable GitHub Data Aggregation System

A full architecture proposal for aggregating data from 300+ GitHub repositories, serving it to a website, and scaling to 10,000 repos — with minimal API usage and graceful failure handling.

### Documents

| Document | Description |
|----------|-------------|
| [Architecture Diagram](./Tsk1/Idea-DOCS/architecture-diagram.md) | Mermaid system diagrams, component breakdown, 300→10k scaling path |
| [Design Doc](./Tsk1/Idea-DOCS/design-doc.md) | Ingestion pipeline, processing, storage, rate limiting, failure modes |
| [API Flow](./Tsk1/Idea-DOCS/api-flow.md) | Sequence diagrams, REST endpoint specs, GraphQL schema |
| [Tech Justification](./Tsk1/Idea-DOCS/tech-justification.md) | 13-row decision table, 5 rejected alternatives with rationale |

### Stack

`Lambda / Vercel` · `Amazon SQS` · `NestJS` · `MongoDB` · `Redis` · `Angular 17` · `Docker`

---

## Task 2 — GitHub Repository Intelligence Analyzer

A live web tool that scores GitHub repositories by how approachable they are for new contributors — rating them **Beginner**, **Intermediate**, or **Advanced** based on activity, code complexity, and community health signals.

**Live demo:** https://frontend-six-inky-50.vercel.app
**Backend:** https://backend-seven-orcin-65.vercel.app

### Try it

1. Open the [live frontend](https://frontend-six-inky-50.vercel.app)
2. Paste a repo URL — e.g. `nestjs/nest`, `c2siorg/Webiu`, `sindresorhus/awesome`
3. Review the difficulty rating and the explainability breakdown

### Scoring Models

| Model | Status | Signals | Notes |
|-------|--------|---------|-------|
| **V1** | ✅ Production | 9 | Activity, complexity, community — with confidence score and explainable output |
| **V2** | 📋 Proposed | 20+ | Temporal trends, ecosystem awareness, confidence intervals, validation roadmap |

Model documentation lives in [`Tsk2/`](./Tsk2/):

- [`SCORING.md`](./Tsk2/SCORING.md) — V1 formulas and scoring boundaries
- [`SCORING-V2-ENHANCED.md`](./Tsk2/SCORING-V2-ENHANCED.md) — V2 proposal with new signals
- [`VALIDATION-STRATEGY.md`](./Tsk2/VALIDATION-STRATEGY.md) — ground truth validation and rollout plan
- [`STRENGTHENING-SUMMARY.md`](./Tsk2/STRENGTHENING-SUMMARY.md) — executive summary of V1→V2 improvements

### Stack

`Node.js` · `Express` · `TypeScript` · `Vercel Serverless` · `Octokit`

---

## GSoC Idea

[`GSOC_IDEA.md`](./GSOC_IDEA.md) — **Webiu Production Readiness and Intelligent Project Discovery** *(350 hours)*

Task 1's architecture is the target end-state. The GSoC project is the incremental path to get there, across five areas:

- API optimisation
- Serverless evaluation PoC
- CI/CD automation
- Admin controls
- Lightweight AI-powered project discovery

---

## Links

| Resource | URL |
|----------|-----|
| Task 1 README | [Tsk1/README.md](./Tsk1/README.md) |
| Task 2 README | [Tsk2/README.md](./Tsk2/README.md) |
| GSoC Idea | [GSOC_IDEA.md](./GSOC_IDEA.md) |
| CI Workflow | [.github/workflows/ci.yml](./.github/workflows/ci.yml) |
| Frontend | https://frontend-six-inky-50.vercel.app |
| Backend | https://backend-seven-orcin-65.vercel.app |