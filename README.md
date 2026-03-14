# Pre-GSoC Tasks — c2siorg / Webiu 2026

> **Author:** Shashwat Darshan ([@Shashwat-Darshan](https://github.com/Shashwat-Darshan))
> **Repository:** [webiu-gsoc-pre-task](https://github.com/Shashwat-Darshan/webiu-gsoc-pre-task)
> **Submitted:** March 2026

---

## Overview

| Task | Title | Status | Deliverables |
|------|-------|--------|--------------|
| [Task 1](./Tsk1/README.md) | Scalable GitHub Data Aggregation System | ✅ Complete | Architecture diagram · Design doc · API flow · Tech justification |
| [Task 2](./Tsk2/README.md) | GitHub Repository Intelligence Analyzer | 🚧 In Progress | Source code · Sample reports · Scoring doc · Deployment guide |

> The system architecture from Task 1 is the production-ready north star for the GSoC idea outlined in [`GSOC_IDEA.md`](./GSOC_IDEA.md).

---

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

Live tool that scores and ranks GitHub repositories using a weighted multi-factor algorithm.

| Document | Description |
|----------|-------------|
| [README](./Tsk2/README.md) | Setup, usage, and feature overview |
| [Scoring](./Tsk2/SCORING.md) | Scoring algorithm, weights, and factor breakdown |
| [UI Contract](./Tsk2/UI_CONTRACT.md) | API response schema for frontend consumption |
| [Deployment](./Tsk2/DEPLOYMENT.md) | Docker and environment setup guide |
| [Sample Outputs](./Tsk2/sample-outputs/README.md) | Example scored repository reports |
| [Backend Source](./Tsk2/backend/) | NestJS · TypeScript · Dockerfile · docker-compose |

**Stack:** NestJS · TypeScript · Docker · GitHub REST API

---

## GSoC Idea

[`GSOC_IDEA.md`](./GSOC_IDEA.md) — *WebiU Production Readiness and Intelligent Project Discovery*

350-hour GSoC idea across 5 areas: API optimisation, serverless evaluation PoC, CI/CD automation, admin controls, and lightweight AI project discovery. Task 1's architecture is the target end-state; the GSoC phases are the incremental delivery path toward it.