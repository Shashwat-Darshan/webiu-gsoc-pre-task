# Pre-GSoC Tasks — c2siorg / Webiu 2026

> **Author:** Shashwat Darshan ([@Shashwat-Darshan](https://github.com/Shashwat-Darshan))
> **Repository:** [webiu-gsoc-pre-task](https://github.com/Shashwat-Darshan/webiu-gsoc-pre-task)
> **Submitted:** March 2026

---

## Overview

| Task | Title | Status | Deliverables |
|------|-------|--------|--------------|
| [Task 1](./Tsk1/README.md) | Scalable GitHub Data Aggregation System | ✅ Complete | Architecture diagram · Design doc · API flow · Tech justification |
| [Task 2](./Tsk2/README.md) | GitHub Repository Intelligence Analyzer | ✅ Deployed & Working | Source code · sample outputs · scoring docs (V1 + V2) · usage guide |

> The system architecture from Task 1 is the production-ready north star for the GSoC idea outlined in [`GSOC_IDEA.md`](./GSOC_IDEA.md).

---

## Project quick links

- Main README: https://github.com/Shashwat-Darshan/webiu-gsoc-pre-task/blob/master/README.md
- Task 1 README: https://github.com/Shashwat-Darshan/webiu-gsoc-pre-task/blob/master/Tsk1/README.md
- Task 2 README: https://github.com/Shashwat-Darshan/webiu-gsoc-pre-task/blob/master/Tsk2/README.md
- CI workflow: https://github.com/Shashwat-Darshan/webiu-gsoc-pre-task/blob/master/.github/workflows/ci.yml
- Frontend deployment: https://frontend-six-inky-50.vercel.app
- Backend deployment: https://backend-seven-orcin-65.vercel.app

## Task 1 — Scalable GitHub Data Aggregation System

Design exercise: propose a full architecture for aggregating data from 300+ GitHub repositories, serving it to a website, minimising API usage, and scaling to 10,000 repos.

| Document | Description |
|----------|-------------|
| [README](./Tsk1/README.md) | 10-section design overview covering all requirements |
| [Architecture Diagram](./Tsk1/Idea-DOCS/architecture-diagram.md) | Mermaid system diagram · component table · 300→10k scaling diagram |
| [Design Explanation](./Tsk1/Idea-DOCS/design-doc.md) | 2-page deep-dive: ingestion, processing, storage, rate limiting, failure handling |
| [API Flow](./Tsk1/Idea-DOCS/api-flow.md) | Sequence diagrams · REST endpoint specs · GraphQL schema |
| [Technology Justification](./Tsk1/Idea-DOCS/tech-justification.md) | 13-row decision table · 5 rejected alternatives with reasons |

**Stack:** Serverless Functions (Lambda/Vercel) · Amazon SQS · Lambda Workers · NestJS (serving-only) · MongoDB · Redis · Angular 17 · Docker

---

## Task 2 — GitHub Repository Intelligence Analyzer

**Status:** ✅ Deployed and working

A live web tool that analyzes GitHub repositories and tells you how hard it would be for a newcomer to contribute. It scores activity, complexity, and community friendliness—then gives a `Beginner` / `Intermediate` / `Advanced` difficulty rating.

**Live demo:** https://frontend-six-inky-50.vercel.app

### What Task 2 includes

1. **Working Frontend** — Web interface to input repo URLs and see results
2. **Production Backend** — Express.js API deployed to Vercel, fetches live GitHub data
3. **V1 Scoring Model** — Current implementation with 9 core signals (activity, complexity, community)
4. **V2 Proposal** — Strengthened model with 20+ signals, confidence intervals, and explainability

### Scoring models

| Model | Status | Details |
|-------|--------|----------|
| **V1** | ✅ Production | 9 signals, confidence score, explainable drivers |
| **V2** | 📋 Designed | 20+ signals, temporal trends, ecosystem awareness, validation roadmap |

Both models are documented in the Task 2 folder:
- `SCORING.md` — V1 current formulas and boundaries
- `SCORING-V2-ENHANCED.md` — V2 proposal with new signals and confidence intervals
- `VALIDATION-STRATEGY.md` — How to validate and roll out V2 with ground truth
- `STRENGTHENING-SUMMARY.md` — Executive summary of improvements

### How mentors evaluate Task 2

1. Visit the [live frontend](https://frontend-six-inky-50.vercel.app)
2. Paste some repo URLs (e.g., `nestjs/nest`, `c2siorg/Webiu`, `sindresorhus/awesome`)
3. Review the difficulty ratings and explainability drivers
4. Check [Task 2 README](./Tsk2/README.md) for usage details

**Stack:** Node.js · Express.js · TypeScript · Vercel (serverless) · Octokit GitHub API

---

## Recommended Reading Path

1. Start with [Task 2 README](./Tsk2/README.md) to see what the live system does.
2. Move to [Task 1 README](./Tsk1/README.md) for deep technical architecture and formula details.
3. If needed, review [GSOC_IDEA.md](./GSOC_IDEA.md) for roadmap context.

---

## GSoC Idea

[`GSOC_IDEA.md`](./GSOC_IDEA.md) — *WebiU Production Readiness and Intelligent Project Discovery*

350-hour GSoC idea across 5 areas: API optimisation, serverless evaluation PoC, CI/CD automation, admin controls, and lightweight AI project discovery. Task 1's architecture is the target end-state; the GSoC phases are the incremental delivery path toward it.