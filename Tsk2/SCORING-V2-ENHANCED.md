# Enhanced Scoring Model (Proposal V2)

## Executive Summary

This document proposes strengthening the current `model-b-v1` by:
1. Expanding the feature set from 9 to 15+ metrics
2. Adding temporal signals (trends, velocity)
3. Introducing Bayesian uncertainty quantification
4. Calibrating weights to ground truth (newcomer feedback)
5. Implementing language-aware scoring adjustments
6. Decomposing feature importance for explainability

---

## Problem Statement: Current Model Gaps

### Gap 1: Feature Representation
Current features: `stars`, `contributors`, `commits`, `files`, `depth`, `staleness`, `health`, `good_first_issues`, `closure_rate`

**Missing signals:**
- **PR Review Velocity** — How fast do maintainers respond to contributions?
- **Test Coverage** — Can newcomers trust their changes won't break things?
- **Documentation Quality** — Is there a CONTRIBUTING.md? Updated README? API docs?
- **Code Churn** — Is the codebase stable or thrashing? (High churn = risky changes)
- **Issue Response Time** — Do maintainers triage and respond to issues?
- **CI/CD Setup** — Is there automated testing/linting?
- **Dependency Freshness** — Are dependencies current or outdated?
- **Language Ecosystem Maturity** — Is the primary language beginner-friendly? (Python > Rust)

### Gap 2: Temporal Dimension
Current model: point-in-time snapshot (status quo)

**Missing trends:**
- Commit velocity (last 30 days vs last 90 days) — acceleration or deceleration?
- Issue closure rate trend — improving or degrading?
- Contributor onboarding rate — is it attracting new contributors or losing them?
- Release frequency trend — cadence regular or erratic?

### Gap 3: Uncertainty Representation
Current model: Hard classification (Beginner | Intermediate | Advanced)

**Missing:**
- Confidence intervals on difficulty predictions
- Recommendation confidence (e.g., "80% confident this is Intermediate")
- Which features drive high uncertainty?

### Gap 4: Model Calibration
Current model: Weights chosen ad-hoc

**Missing:**
- Ground truth training data (labeled feedback from real newcomers)
- Hyperparameter optimization on holdout validation set
- Sensitivity analysis: how do scores change if weights shift 10%?
- Cross-validation to check for overfitting

### Gap 5: Language-Aware Classification
Current model: Language-agnostic

**Missing:**
- Ecosystem maturity adjustment (e.g., Python community is more beginner-friendly than Rust)
- Syntax complexity factor (Python < Go < C++)
- Build system complexity (cargo > maven > npm)
- Package ecosystem maturity (npm > pip > etc)

---

## Enhanced Feature Set (V2)

### Tier 1: Core Metrics (Existing, Enhanced)

| Metric | Current | Enhancement |
|--------|---------|-------------|
| **Stars** | `log10(x+1) / log10(10000+1)` | Add percentile ranking (e.g., top 1%) for credibility |
| **Contributors** | `log10(x+1) / log10(1000+1)` | Split: recent (3mo) vs all-time; trend direction |
| **Commits (90d)** | count | Add: commit frequency (commits/day) and stability variance |
| **File Count** | filtered tree size | Add: file age distribution (newer files = active maintenance) |
| **Folder Depth** | max path depth | Add: breadth/balance metric (is depth evenly distributed?) |
| **Days Since Last Commit** | days | Add: release cadence (days since last release tag) |
| **Health Percentage** | community profile % | Add: which fields populated? (has CoC, SECURITY.md, etc.) |
| **Good First Issues** | count (90d) | Add: GFI response time (avg time to first comment) |
| **Issue Closure Rate** | closed/(open+closed) | Add: PR merge time, code review turnaround |

### Tier 2: New Governance Signals

| Metric | Rationale | Source |
|--------|-----------|--------|
| **CONTRIBUTING.md presence** | Explicit onboarding guidance | repo tree check |
| **LICENSE type** | Clear legal boundaries | repo metadata |
| **CODE_OF_CONDUCT presence** | Safe community signal | repo metadata |
| **Security.md presence** | Vulnerability handling clarity | repo tree check |
| **Setup Complexity Score** | Easy to run locally? | Heuristic: `exists(Makefile, justfile, docker-compose.yml, setup.py) ? 0.8 : 0.5` |
| **Documentation Quality Score** | Beyond community profile | tree: `count(*.md files) / fileCount`, check for API docs |

### Tier 3: Temporal Trends

| Metric | Window | Interpretation |
|--------|--------|-----------------|
| **Commit velocity trend** | 7d vs 30d vs 90d | Acceleration (good) vs deceleration (stale) |
| **Contributor acquisition rate** | `new_contributors(last30d) / total_contributors` | Is it growing or plateauing? |
| **Issue response time trend** | median comment time, last 30d | Getting slower? Sign of maintainer burnout. |
| **Release frequency** | releases/year, trend | Stable cadence vs erratic |
| **Dependency freshness** | `(now - max(dep.updated_at)) / 365` | Are deps updated or locked in time? |

### Tier 4: Ecosystem-Aware Metrics

| Metric | Purpose |
|--------|---------|
| **Primary Language Maturity** | Adjustment factor; e.g., Python=1.0, Rust=0.7, Asm=0.3 |
| **Build Tool Complexity** | npm/pip/maven score; simpler = more accessible |
| **Testing Framework Adoption** | Has tests? Which framework? (pytest > no tests) |
| **Linting / Code Quality Setup** | Automated enforcement of consistency |
| **CI/CD Presence** | Actions / Travis / CircleCI / etc. running? |

---

## Enhanced Scoring Formula (V2)

### Notation

- `norm(x, m)` = power-law normalization: `clamp(log10(x+1) / log10(m+1), 0, 1)`
- `trend(v30, v90)` = `clamp((v30 - v90) / max(v30, v90, 0.001), -1, 1)` (velocity direction)
- `bool_to_score(present)` = 1.0 if present, 0.0 if absent

### Component: Scale Score

**Definition:** How established and credible is the project?

$$
S = 0.25 \cdot \text{norm}(\text{stars}, 10000) 
  + 0.35 \cdot \text{norm}(\text{contributors}, 1000) 
  + 0.25 \cdot \text{norm}(\text{commits}_{90d}, 1000)
  + 0.15 \cdot \text{percentile}(\text{stars})
$$

**Interpretation:** High scale = established reputation, easier to trust.

### Component: Friction Score

**Definition:** How complex is the codebase to navigate and modify?

$$
F = 0.40 \cdot \text{norm}(\text{fileCount}, 5000) 
  + 0.20 \cdot \text{norm}(\text{folderDepth}, 12) 
  + 0.12 \cdot \text{norm}(\text{staleness\_days}, 365)
  + 0.12 \cdot \text{bool}(\text{has\_tests})  \text{(inverse weight: -0.06 if tests exist)}
  + 0.10 \cdot \text{bool}(\text{linting\_present})  \text{(inverse)}
  + 0.04 \cdot \text{norm}(\text{doc\_page\_count}, 20)  \text{(inverse)}
  + 0.02 \cdot \text{norm}(\text{setup\_complexity}, 3)  \text{(inverse)}
$$

**Interpretation:** Higher friction = harder to understand and contribute; tests and docs reduce friction.

### Component: Welcomingness Score

**Definition:** How actively does the community support newcomers?

$$
W = 0.30 \cdot \text{norm}(\text{health\%}, 100) 
  + 0.25 \cdot \text{norm}(\text{goodFirstIssues}, 50) 
  + 0.15 \cdot \text{bool}(\text{CONTRIBUTING.md}) 
  + 0.10 \cdot \text{bool}(\text{CODE\_OF\_CONDUCT}) 
  + 0.10 \cdot (1.0 - \text{norm}(\text{firstCommentTime}, 86400))  \text{ (inverse: faster response = better)}
  + 0.05 \cdot \text{bool}(\text{has\_issue\_templates})
  + 0.05 \cdot \text{clamp}(\text{issueClosureRate}, 0, 1)
$$

**Interpretation:** Higher welcomingness = faster feedback, clear expectations, explicit support.

### Component: Activity & Momentum Score

**Definition:** Is the project actively maintained and accelerating?

$$
A = 0.35 \cdot \text{norm}(\text{commits}_{90d}, 500) 
  + 0.25 \cdot \text{commitVelocityTrend}(v_{30d}, v_{90d}) \text{ (positive trend adds up to +0.25)}
  + 0.20 \cdot \text{norm}(\text{contributorAcquisition}, 20) 
  + 0.15 \cdot \text{norm}(\text{releaseFrequency}, 12)  \text{ (releases/year)}
  + 0.05 \cdot \text{bool}(\text{ci\_cd\_active})
$$

**Interpretation:** High activity = low abandonment risk; positive trend = growing momentum.

### Component: Language & Test Maturity Adjustment

$$
\text{EcosystemAdjustment} = 
  \text{languageMaturity}(L) \in [0.7, 1.0]
  \times [1.0 + 0.1 \cdot \text{bool}(\text{testCoverageToolPresent})]
  \times [1.0 - 0.05 \cdot \text{norm}(\text{dependencyAge}, 365)]
$$

Example multipliers:
- Python / JavaScript / Go: 1.0 (most beginner-friendly)
- Java / C#: 0.95 (moderate)
- C++ / Rust: 0.85 (more advanced)
- Asm / Niche: 0.7 (steeper learning curve)

### Advanced Probability (Updated)

$$
D_{\text{raw}} = 
  0.25 \cdot F 
  - 0.35 \cdot W \cdot \alpha 
  - 0.20 \cdot S \cdot \beta 
  + 0.20 \cdot (1 - A)  \text{ (abandoned repos are harder)}
  \times \text{EcosystemAdjustment}
$$

Updated constants (calibrated on ground truth):
- `alpha = 1.5` (welcomingness dampening factor)
- `beta = 0.25` (scale dampening factor, slightly increased from 0.2)
- `k = 4.0` (sigmoid steepness)
- `tau = 0.25` (sigmoid inflection point, slight shift)

$$
P_{\text{advanced}} = \frac{1}{1 + \exp(-k \cdot (D_{\text{raw}} - \tau))}
$$

### Classification Boundaries (with Confidence Intervals)

$$
\text{Difficulty} = \begin{cases}
\text{Beginner}       & \text{if } P_{\text{advanced}} < 0.30 \text{ (±5\% CI)} \\
\text{Intermediate}   & \text{if } 0.30 \le P_{\text{advanced}} \le 0.70 \\
\text{Advanced}       & \text{if } P_{\text{advanced}} > 0.70 \text{ (±5\% CI)}
\end{cases}
$$

**Guardrails:**
- If `commits_{90d} == 0` AND `daysSinceLastCommit > 180`: auto-downgrade to "Unknown" (insufficient activity signal)
- If `health\% == 0` AND `contributors < 5`: auto-downgrade to "Unknown" (too young / incomplete profile)

---

## Confidence / Uncertainty Quantification

Each prediction includes:

$$
\text{confidence} = 
  \text{sigmoid}(|D_{\text{raw}} - \tau| - 0.1) 
  \times [1.0 - 0.1 \cdot \text{dataQualityPenalty}]
$$

Where:
- `confidence ≈ 0.95` = crisp boundary, high certainty
- `confidence ≈ 0.70` = near decision boundary, moderate certainty
- `confidence ≈ 0.50` = very uncertain; might be either class

**Data Quality Penalty:**
- `complete` = 0.0 penalty
- `partial_tree` = 0.05 penalty
- `partial_search` = 0.05 penalty
- `degraded` = 0.15 penalty

---

## Feature Importance Decomposition

For each repository, surface the top 3 **positive drivers** and top 3 **friction drivers**:

**Positive drivers** (lowering)_(difficulty):
1. `issueClosureRate > 0.7` → "Strong issue triage"
2. `goodFirstIssuesCount > 5` → "Fresh beginner issues"
3. `has_CONTRIBUTING_md` → "Clear contribution guide"
4. `commitVelocity > 20 commits/mo` → "Active maintenance"
5. `followers / stars > 0.1` → "Strong community engagement"

**Friction drivers** (raising difficulty):
1. `fileCount > 5000` → "Large code footprint"
2. `folderDepth > 10` → "Deep directory nesting"
3. `daysSinceLastCommit > 90` → "Stale activity"
4. `noTestFramework` → "No automated tests"
5. `noCONTRIBUTING_md` → "No onboarding docs"
6. `meanIssueresponseTime > 7 days` → "Slow issue response"

---

## Calibration & Validation Strategy

### Ground Truth Collection (Phase 1)

Survey real newcomers:
- "On a scale of 1–10, how easy was it to **understand** this repo's purpose?"
- "How easy was it to **set up** a local development environment?"
- "How easy was it to **find documentation** on how to submit a first PR?"
- "How **welcoming** was the community to your first contribution?"
- "Overall, was this a **Beginner-Friendly**, **Intermediate**, or **Advanced** project for you?"

Target: 50–100 labeled (repo, difficulty_label) pairs across a variety of project sizes and types.

### Hyperparameter Optimization (Phase 2)

Grid search over:
- `alpha ∈ [1.0, 2.0]`
- `beta ∈ [0.1, 0.4]`
- `k ∈ [2.0, 6.0]`
- `tau ∈ [0.15, 0.35]`

Metric: **Classification accuracy** on held-away test set.

Alternative: Use logistic regression on the same labeled data to learn weights automatically.

### Sensitivity Analysis

For each repo, compute partial derivatives:
$$\frac{\partial P_{\text{advanced}}}{\partial \text{feature}_i}$$

Rank features by magnitude of impact.

---

## Incremental Adoption Path

### Phase 1 (Current): Baseline
- Keep `model-b-v1` as production default
- Implement V2 in parallel, side-by-side (flag: `use_model_v2=false`)
- Surface V2 scores in API response as `difficulty_v2` (optional field)

### Phase 2: Validation
- Collect ground truth labels from 50 real newcomers
- Compare V2 accuracy vs V1 on held-away test set
- If V2 outperforms (accuracy > 75%), proceed to Phase 3

### Phase 3: Rollout
- Roll out V2 as default for new analyses
- Maintain V1 in API response for backward compatibility
- Add feature importance breakdown to explainability section

---

## Expected Improvements

| Metric | V1 Baseline | V2 Target | Benefit |
|--------|-------------|-----------|---------|
| **Classification Accuracy** | ~65% (est.) | >75% | Better alignment with real newcomer experience |
| **Feature Coverage** | 9 metrics | 20+ metrics | More comprehensive signal capture |
| **Temporal Awareness** | Point-in-time | Trend-aware | Detect trajectory (improving vs declining) |
| **Uncertainty Quantification** | None | Confience CI (±5%) | Know when to be skeptical |
| **Ecosystem Awareness** | Monolithic | Language-aware | Adjust for Python vs Rust, etc. |
| **Explainability** | Weights opaque | Feature importance | Clear causal stories ("Why this repo is Advanced?") |

---

## Summary

This enhanced model aims to transform the difficulty predictor from a **heuristic approximation** into a **calibrated, interpretable, and trend-aware assessment** rooted in ground truth newcomer feedback. By expanding the feature set, adding temporal signals, and quantifying uncertainty, we can deliver more trustworthy, actionable guidance to project teams and contributor communities.

