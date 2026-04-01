# 🧠 Task 2 — GitHub Repository Intelligence Analyzer

> **A smart, live-data evaluation engine that analyzes GitHub repositories to predict exactly how difficult it would be for a newcomer to contribute.**

---

### ✨ What This Tool Does

Provide a list of GitHub repository URLs, and our analyzer will ingest live metrics—including **stars, forks, contributors, languages, open issues, and commits**—to deliver a comprehensive onboarding assessment:

- 📊 **Difficulty:** Classified strictly into `Beginner` 🟢, `Intermediate` 🟡, or `Advanced` 🔴
- 🎯 **Confidence Score:** A probability metric indicating our certainty of the rating
- ⚙️ **Core Metrics:** Custom-calculated algorithms measuring *Activity*, *Complexity*, and *Welcomingness*
- 💡 **Explainability:** The top 3 positive drivers making the repo welcoming, and the top 3 friction points slowing newcomers down

---

### 🚀 Live Demo & Links

| Service | Architecture | Deployment URL |
|---------|--------------|----------------|
| **Frontend UI** | Vite + React | [Try the Live Demo](https://frontend-six-inky-50.vercel.app) |
| **Backend API** | Node.js + Express | [API Endpoint](https://backend-seven-orcin-65.vercel.app) \| [Health Check](https://backend-seven-orcin-65.vercel.app/health) |

> 💡 **Suggested Test Repos:** Try pasting `nestjs/nest`, `c2siorg/Webiu`, or `sindresorhus/awesome` into the UI!

<details>
<summary><b>🛠️ How to run locally (Click to expand)</b></summary>
<br>
To run the architecture on your own machine, follow these component-specific setup guides:

- 💻 **[Backend Setup & Local API Docs](./backend/README.md)**
- 🎨 **[Frontend Setup & Development Docs](./frontend/README.md)**
</details>

---

### 📘 Single Source of Truth

Use [`docs/SCORING.md`](./docs/SCORING.md) as the authoritative scoring reference for:

- Current production model (`model-b-v2`)
- Outcome interpretation and UI summary combinations
- Explainability expectations and reporting checklist
- Roadmap items retained for future iterations

If you see historical sample output with `model-b-v1`, treat it as legacy output generated before the current production model upgrade.

---

### 🏗️ Stack & Architecture Highlights

- **Serverless Hosting:** We use **Vercel** for hosting both the high-performance React frontend and the Express.js API.
- **Data Ingestion:** Live data fetching routed asynchronously via the **Octokit REST API**.
- **Efficiency & Rate Limiting:** 
  - Integrated GitHub PAT configuration to seamlessly bypass unauthenticated limits (scaling from *60 → 5000 requests/hour*).
  - Backend implements an intelligent concurrency limiter to actively prevent secondary rate-limit bans.
- **Graceful Degradation:** If a repository's tree is excessively huge or data is temporarily missing, the engine falls back safely using `data_quality` states (`partial_search`, `partial_tree`, `degraded`) instead of crashing.
- **CI/CD Quality Control:** **GitHub Actions** runs quality checks (lint/build) while **Vercel** handles automated production deployments.

---

### 🔍 Understanding the Output

Every repository analyzed returns a highly detailed JSON payload:

| Field | Description |
|-------|-------------|
| `difficulty` | The final computed category (`Beginner`, `Intermediate`, `Advanced`). |
| `confidence_score`| The raw model probability used for classification. |
| `metrics_fields` | Direct exposure of internal scores (e.g., `activity_score`, `complexity_score`). |
| `explainability` | Crystal-clear rationale detailing exactly *why* the repository received its rating. |
| `data_quality` | Flags whether full data was extracted (`complete`) or if safe fallbacks were triggered. |

> **Pro-Tip:** A repository flagged with `Advanced` difficulty but featuring incredibly strong `explainability` drivers might still be an excellent choice for a highly experienced engineer!

### 🧭 Outcome Combinations You Can Get

<details>
<summary><b>Click to view/hide one-glance summary combinations</b></summary>
<br>

The one-glance summary shown in UI is deterministic and based on score combinations and fallback order.

Thresholds:

- High: score `>= 70`
- Low: score `> 0 and <= 35`

Possible summaries:

1. Complexity high + onboarding high -> Difficulty-aware summary:
  `Intermediate`: `Large and complex, but onboarding support keeps it in a manageable intermediate range.`
  `Beginner` with higher confidence: `Complex and well-guided, but still carries moderate newcomer ramp-up risk.`
  otherwise: `Complex but newcomer-friendly with strong guidance and support paths.`
2. Complexity high + onboarding low -> `Complex and newcomer-challenging with limited onboarding guidance.`
3. Complexity low + onboarding high -> `Simple structure and beginner-friendly contribution path.`
4. Difficulty is Beginner -> `Beginner-friendly contribution path with manageable onboarding friction.`
5. Difficulty is Intermediate -> `Moderate complexity with a manageable learning curve.`
6. Activity low -> `Beginner path may be slower due to low recent project activity.`
7. Otherwise -> `Complex setup expected due to project scale or structural friction.`

Error case override:

- If repository fetch fails or difficulty is `Unknown` -> `Insufficient data to estimate newcomer friendliness.`

</details>

---

### ✅ What Else Your README/Report Should Mention

<details>
<summary><b>Click to view/hide recommended report fields</b></summary>
<br>

When presenting a repo result (for example `nestjs/nest`), include these fields together so the conclusion is fully justified:

- Classification trio: `difficulty`, `confidence_score`, `model_version`
- Core dimensions: `activity_score`, `complexity_score`, `onboarding_health_score`
- Maintenance evidence: `commits_last_90d`, `closed_issues_last_90d`, `releases_last_year`, `days_since_last_commit`
- Community evidence: `good_first_issues_count`, `issue_closure_rate`, `contributors_count`
- Scope evidence: `file_count`, `folder_depth`, `language_count`, `primary_language`
- Reliability caveat: `data_quality`
- Explainability bundle: `rationale`, positive drivers, friction drivers, and `notes`

This prevents over-relying on a single label and makes outcomes actionable for newcomers.

</details>

---

### 🧮 How the Production Formula Works

The intelligence analyzer computes four normalized sub-scores (`0.0` to `1.0`) by applying power-law normalization (`log_norm`) to GitHub metrics.

<details>
<summary><b>View Mathematical Formulations</b></summary>
<br>

**1. Scale (S):** Measures ecosystem size and active heartbeat.
```text
S = 0.20*log_norm(stars, 10k) + 0.35*log_norm(contributors, 1k) + 0.45*log_norm(commits90d, 1k)
```
   
**2. Friction (F):** Measures architectural complexity and project staleness.
```text
F = 0.60*log_norm(fileCount, 5k) + 0.20*log_norm(folderDepth, 12) + 0.20*staleness
```
   
**3. Welcomingness (W):** Measures community health and beginner engagement.
```text
W = 0.50*(healthPercentage/100) + 0.30*log_norm(freshGoodFirstIssues, 50) + 0.20*issueClosureRate
```

**4. Activity Momentum (A):** Measures maintenance consistency and release cadence.
```text
A = 0.35*log_norm(commits90d, 500) + 0.20*log_norm(closedIssues90d, 200) + 0.15*log_norm(releasesLastYear, 24)
  + 0.20*(1-staleness) + 0.10*issueClosureRate
```

**The Final Threshold Logic:**  
Weighing Friction against Welcomingness, Scale, and Momentum gives us the raw difficulty, then adjusts it using ecosystem and data-quality factors:
`D_adj = (0.55*F - 1.45*W - 0.22*S + 0.35*(1-A)) * EcosystemAdjustment + 0.40*DataReliabilityPenalty`

This is passed through a sigmoid probability curve (`P_advanced`) to categorize the repository:
- 🟢 **Beginner:** `P_advanced < 0.35` *(Auto-downgraded to Intermediate if repo is fundamentally stale)*
- 🟡 **Intermediate:** `0.35 <= P_advanced <= 0.70`
- 🔴 **Advanced:** `P_advanced > 0.70`

For the complete implementation-level specification, refer to [`docs/SCORING.md`](./docs/SCORING.md).

</details>

---

### 📦 Quick Technical Lookup

*All design and validation documents have been cleanly organized into the [`docs/`](./docs/) directory to keep the root clutter-free.*

- **Sample JSON Outputs:** View realistic test-runs in our [`sample-outputs/`](./sample-outputs/) directory.
- **Task 1 Baseline:** Review the overarching architectural strategy in [`../Tsk1/README.md`](../Tsk1/README.md).
- **Final Scoring Spec:** Use [`docs/SCORING.md`](./docs/SCORING.md) as the single source of truth for both current implementation and next-iteration roadmap.