# WebiU — GSoC 2026 Proposal

> **Title:** WebiU Production Readiness and Intelligent Project Discovery
> **Date:** March 10, 2026
> **Difficulty:** Medium
> **Estimated Effort:** 350 hours

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Repository & Mentors](#2-repository--mentors)
3. [Problem Statement](#3-problem-statement)
4. [Goals](#4-goals)
5. [Technical Approach](#5-technical-approach)
6. [Expected Results](#6-expected-results)
7. [350-Hour Timeline](#7-350-hour-timeline)
8. [Validation Metrics](#8-validation-metrics)
9. [Risk & Mitigation](#9-risk--mitigation)
10. [Final Statement](#10-final-statement)

---

## 1. Project Summary

WebiU is a dynamic organization website built with reusable components that fetches repository and contributor data from GitHub in near real time. The platform already delivers core value, but requires production-readiness improvements in API efficiency, deployment reliability, admin operations, and project discoverability.

This proposal focuses on **practical, low-complexity upgrades** that fit a 350-hour GSoC timeline across five areas:

| # | Area | Nature |
|---|------|--------|
| 1 | API Optimization | Performance |
| 2 | Alternative Backend Strategy | Architecture PoC |
| 3 | CI/CD Integration | DevOps |
| 4 | Admin Features | Operational |
| 5 | Lightweight AI Enhancements | Discoverability |

---

## 2. Repository & Mentors

| Field | Detail |
|-------|--------|
| **Repository** | [github.com/c2siorg/Webiu](https://github.com/c2siorg/Webiu) |
| **Mentors** | Mahender Goud Thanda (`Maahi10001`), Charith |
| **Slack Channel** | `#WebiU` |
| **Difficulty** | Medium |
| **Estimated Effort** | 350 hours |

---

## 3. Problem Statement

WebiU's current features are useful, but four gaps remain before the platform can be considered production-ready:

1. **API responses** can be faster and lighter — endpoints currently return unshapped payloads with no field minimization.
2. **CI/CD and deployment safeguards** rely on manual processes with no automated gates.
3. **Admin users** have no analytics or manual refresh controls for operational visibility.
4. **Project discoverability** is purely metadata-driven with no AI-assisted summarization or smart search.

---

## 4. Goals

### 4.1 API Optimization
- Refactor high-traffic endpoints for lower latency and smaller payloads.
- Improve cache strategy and keep GZIP compression verified and consistent.
- Explore GraphQL for selective, read-heavy scenarios to eliminate over-fetching.

### 4.2 Alternative Backend Strategy
- Evaluate hybrid serverless / event-driven options for data refresh workloads.
- Build one **proof-of-concept** without forcing a full migration away from NestJS.

### 4.3 CI/CD Integration
- Automate lint, test, build, and deploy checks with **GitHub Actions**.
- Add rollback strategy and failure notification flow.

### 4.4 Admin Features
- Add project-level analytics for operational visibility.
- Add secured **manual refresh controls** for API and AI outputs.

### 4.5 Lightweight AI Enhancements
- Generate concise project summaries from README content and repository metadata.
- Detect technology stack for accurate badges and filtering.
- Add optional natural-language query mapping to metadata search.
- Cache AI outputs and refresh only after repository changes (source-hash policy).

---

## 5. Technical Approach

### A. API Performance
- Establish baseline metrics (latency, payload size, cache hit ratio) for all core endpoints.
- Apply response shaping, pagination, and field minimization on list-heavy routes.
- Refine cache-key design and TTL policies per data volatility.
- Verify GZIP is active end-to-end and `Cache-Control` headers are consistent.

### B. Serverless Evaluation
- Compare current **NestJS always-on** approach against a hybrid event-driven path (webhook/scheduled triggers).
- Build a PoC for a webhook-triggered or scheduled refresh pipeline.
- Produce a clear **adopt / defer / reject recommendation** based on complexity, cost, and performance data.

### C. CI/CD
- Add PR gates for frontend and backend: lint → test → build.
- Define deployment flow with release checks and environment promotion.
- Write a rollback runbook and perform at least one validation drill.

### D. Admin Controls
- Add analytics endpoint surfacing refresh counts, cache stats, and system metrics.
- Add manual refresh actions with structured logging and role-based access control.

### E. AI Features

```
Repository change detected (source hash diff)
  └─► Trigger AI refresh pipeline
        ├── Fetch README + metadata
        ├── Generate summary (LLM with constrained template)
        ├── Detect tech stack (languages + topics + README signals)
        ├── Map natural-language query → existing filter fields
        └── Write output to cache (skip if hash unchanged)
```

- Deterministic fallback for all AI outputs (no silent failures).
- Cost controlled via **source-hash-based refresh** — AI is never called if the repo hasn't changed.

---

## 6. Expected Results

| # | Outcome |
|---|---------|
| 1 | Faster and lighter API responses on key routes |
| 2 | Safer and repeatable CI/CD-based releases with automated gates |
| 3 | Admin operational visibility with controlled refresh and metrics |
| 4 | Improved project discoverability via lightweight AI summaries and smart search |
| 5 | Cleaner, well-documented, production-ready architecture |

---

## 7. 350-Hour Timeline

```
Phase 1 ──── Phase 2 ──────────── Phase 3 ─────── Phase 4 ──── Phase 5 ──────────── Phase 6 ── Phase 7
  40h           90h                  60h             55h           70h                  20h       15h
Discovery    API Optimization      CI/CD          Admin Feat.   Lightweight AI       Serverless  Hardening
```

### Phase 1 — Discovery & Baseline (40h)
- Confirm scope and priorities with mentors.
- Measure current p50/p95 latency, payload sizes, and cache behavior across all endpoints.
- Identify top 3–5 endpoints with the highest optimization ROI.
- Produce a written baseline report shared with mentors before Phase 2 begins.

### Phase 2 — API Optimization (90h)
- Payload trimming, field selection, and pagination on list-heavy endpoints.
- GZIP verification and `Cache-Control` header audit.
- Cache key redesign and TTL tuning per data type.
- Endpoint-level regression tests to ensure no data loss from shaping.

### Phase 3 — CI/CD Foundation (60h)
- GitHub Actions workflows for lint, test, and build (frontend + backend).
- Deployment pipeline with environment promotion checks.
- Rollback process documentation and dry-run validation.

### Phase 4 — Admin Features (55h)
- Analytics endpoint: cache hit rate, refresh count, last-sync timestamps.
- Manual refresh UI/API with RBAC and structured audit log.
- Integration tests for admin-only routes.

### Phase 5 — Lightweight AI (70h)
- Summary generation pipeline (LLM with constrained output template + deterministic fallback).
- Tech stack detection from languages, topics, and README signals.
- Optional natural-language → filter mapping layer.
- Source-hash-based refresh policy (AI only re-runs on actual repo changes).

### Phase 6 — Serverless Strategy PoC (20h)
- Implement one end-to-end PoC flow (webhook or scheduled refresh).
- Benchmark against current NestJS approach.
- Deliver a written adopt / defer / reject recommendation.

### Phase 7 — Hardening & Handover (15h)
- Final end-to-end validation across all delivered features.
- Documentation updates (Architecture.md, API_DOCUMENTATION.md, README).
- Live demo recording and final GSoC report.

---

## 8. Validation Metrics

| Metric | Target |
|--------|--------|
| p95 API latency improvement | **30–40%** reduction on selected endpoints |
| Payload size reduction | **25–35%** on list-heavy responses |
| Cache hit ratio | **≥ 70%** for repeated read paths |
| CI gate policy | All required checks must pass before merge |
| AI refresh waste | **0** redundant AI calls for unchanged repos |

---

## 9. Risk & Mitigation

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| **GitHub API rate limits** during development/testing | Medium | Batching, stronger cache strategy, refresh throttling, PAT pool |
| **AI output inconsistency** or hallucination | Medium | Deterministic fallback template; constrained output schemas; human-review flag |
| **Serverless scope creep** pulling focus from core goals | Low–Medium | PoC is explicitly time-boxed to 20h; changes limited to event-driven workloads only |
| **Timeline pressure** from underestimated complexity | Low | Must / Should / Could prioritization maintained throughout; explicit cut list agreed with mentors at Phase 1 |

---

## 10. Final Statement

This proposal improves WebiU through **measurable performance gains**, **safer delivery practices**, **operational admin controls**, and **practical AI enhancements** — all while keeping implementation complexity manageable for a 350-hour GSoC timeline.

Every proposed change extends the existing NestJS + Angular codebase rather than replacing it, ensuring continuity for maintainers and a smooth handover at the end of the programme.

The production-ready target architecture this work moves toward is documented in **[Task 1 — Scalable GitHub Data Aggregation System](./Tsk1/README.md)**. That design (NestJS · BullMQ · Redis · MongoDB · webhooks) is the north star; the GSoC phases above are the incremental, validated path to get there without a disruptive rewrite.