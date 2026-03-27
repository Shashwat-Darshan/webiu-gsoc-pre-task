# Validation & Data Collection Strategy for Enhanced Scoring Model

## Overview

The enhanced scoring model (V2) introduces 20+ new signals, temporal trends, and probabilistic uncertainty. This document outlines:

1. **Feasibility Assessment** — Which signals are GitHub API-accessible vs require heuristics?
2. **Implementation Roadmap** — Phased rollout with minimal disruption
3. **Ground Truth Collection** — How to label real newcomer experiences
4. **Validation Protocol** — Holdout testing, sensitivity analysis, calibration

---

## Feasibility Matrix: Data Availability

| Signal | Source | Difficulty | Est. API Cost |
|--------|--------|-----------|----------------|
| **PR Review Time** | GitHub API (PR timestamps + comments) | Low | 2-3 calls/repo |
| **Test Framework Detection** | Tree inspection (pytest, jest, rspec, etc.) | Low | Already collected |
| **Doc Presence** | Tree: count(*.md files) + heuristic for API docs | Low | Already collected |
| **CONTRIBUTING.md / CODE_OF_CONDUCT** | Tree existence check | Low | Already collected |
| **Setup Complexity** | Heuristic: check for Makefile, docker-compose, setup.py | Low | Already collected |
| **Linting Setup** | Detect: eslint.config.js, .flake8, .pylintrc, etc. | Low | Already collected |
| **CI/CD Presence** | Tree check for .github/workflows, .travis.yml, etc. | Low | Already collected |
| **Dependency Freshness** | Parse package.json, lock files; compare dates | Medium | 1-2 API calls |
| **Language Distribution** | GitHub API: repos.listLanguages() | Low | 1 call/repo (already done) |
| **Commit Velocity Trend** | GitHub API: commits list with "since" filter (3 separate windows) | Medium | 3-6 calls/repo (batch into 1 GraphQL query) |
| **Issue Response Time** | GitHub API: list issues + first comment timestamp | Medium | 2-3 calls/repo |
| **Release Frequency** | GitHub API: repos.listReleases() | Low | 1 call/repo |
| **Contributor Acquisition** | GraphQL: contributors paginated, filter by creation date window | Medium | 1 GraphQL query |
| **Community Health Fields** | GitHub API: repos.getCommunityProfileMetrics() | Low | 1 call/repo (already done) |
| **Code Churn** | Git log: `--numstat` per file, aggregate variance | **High** | Requires repo clone (consider sampling) |
| **Test Coverage %** | Service integration (Codecov, Coveralls API) | **High** | External API integration; rate limited |

**Conclusion:** 80% of V2 signals are low-cost (already-collected or 1-2 API calls). Code churn and test coverage require deeper integration; defer to Phase 2.

---

## Implementation Roadmap

### Phase 1: Months 1–2 (MVP V2)

**Signals to implement:**
- Temporal trends (commit velocity, contributor acquisition, release frequency)
- Governance signals (CONTRIBUTING.md, CoC, SECURITY.md, setup complexity)
- Activity score (with momentum trend)
- Ecosystem adjustment factor (language maturity)
- Confidence intervals

**Backend Changes:**
```typescript
// src/services/github.service.ts—new methods:
async fetchCommitTrendWindows(octokit, repo)  // 7d, 30d, 90d counts
async detectGovernanceSignals(octokit, repo)  // Tree checks
async fetchReleaseFrequency(octokit, repo)    // Releases since 1 year ago
async fetchContributorAcquisition(octokit, repo)  // Contributors by join date window

// src/services/scorer.service.ts—new function:
function scoreV2Model(data: GitHubRepositoryData): ClassificationOutcome
```

**Data Model Additions:**
```javascript
// MongoDB schema addition (optional fields for V2):
{
  ...existing fields...,
  v2Metrics: {
    commitVelocity: { v7d: 5, v30d: 20, v90d: 60 },
    contributorAcquisitionRate: 0.15,  // new contributors / total
    releaseFrequencyPerYear: 8,
    governanceSignals: {
      hasContributing: true,
      hasCodeOfConduct: false,
      hasSecurityMd: true,
      setupComplexity: 0.7,  // 0.0-1.0 scale
    },
    ecoysystemMaturity: {
      primaryLanguage: 'TypeScript',
      maturityFactor: 1.0,
      testFrameworkScore: 0.9,
      ciCdPresent: true,
    },
    modelV2Prediction: {
      difficulty: 'Intermediate',
      advancedProbability: 0.52,
      confidence: 0.78,
      topPositiveDrivers: [...],
      topFrictionDrivers: [...],
    },
  },
}
```

**API Response Addition:**
```json
{
  "repo": "nestjs/nest",
  "url": "...",
  ...existing fields...,
  
  "model_v2": {
    "difficulty": "Intermediate",
    "advanced_probability": 0.52,
    "confidence": 0.78,
    "components": {
      "scale_score": 0.82,
      "friction_score": 0.65,
      "welcomingness_score": 0.71,
      "activity_score": 0.88,
      "ecosystem_adjustment": 0.95
    },
    "feature_importance": {
      "positive_drivers": [
        "Active maintenance (300 commits/90d)",
        "Strong issue triage (78% closure rate)",
        "Fresh beginner issues (12 GFI in last 90d)"
      ],
      "friction_drivers": [
        "Large codebase (2,062 files)",
        "Deep structure (max folder depth: 11)",
        "No explicit setup guide (but docker-compose present)"
      ]
    }
  }
}
```

**Rollout:**
- Add `model_v2` as **optional** field in API responses (feature flag: `enable_model_v2=false` by default)
- Update frontend to display V2 results side-by-side with V1 (in dev/alpha mode only)
- No breaking changes to existing V1 field names

---

### Phase 2: Months 3–4 (Ground Truth Validation)

**Labeling Effort:**
1. Recruit 50–100 contributors from open-source communities (via GSoC mailing list, GitHub issue templates, etc.)
2. Provide GitHub repo URL; ask them to rate their experience on:
   - **Understanding:** "How clear was the repo's purpose?" (1–10)
   - **Setup:** "How hard was the local dev environment?" (1–10)
   - **Onboarding:** "How easy to find contribution docs?" (1–10) 
   - **Community:** "How welcoming was the feedback?" (1–10)
   - **Overall Difficulty:** "Was this Beginner / Intermediate / Advanced?" (categorical)

3. Collect labels in a CSV:
   ```
   repo,understanding,setup,onboarding,community_welcoming,overall_difficulty
   nestjs/nest,8,9,8,9,Beginner
   sindresorhus/awesome,7,8,9,8,Beginner
   rust-lang/rust,4,3,5,6,Advanced
   ...
   ```

**Analysis:**
- Compute V1 and V2 predictions for all labeled repos
- Compare accuracy:
  - **V1 Accuracy:** % repos where V1 prediction matches ground truth
  - **V2 Accuracy:** % repos where V2 prediction matches ground truth
- If V2 > V1 + 5%, proceed to Phase 3

**Hyperparameter Tuning (Optional Logistic Regression):**
```python
# Using scikit-learn, given labeled data:
from sklearn.linear_model import LogisticRegression

# Extract feature vector per repo: [scale, friction, welcomingness, activity, ecosystem_adj]
X = np.array([repo.features for repo in labeled_repos])  # shape: (N, 5)
y = np.array([repo.label for repo in labeled_repos])    # shape: (N,) values: 0/1/2 (Beginner/Intermediate/Advanced)

# Fit multinomial logistic regression with regularization
clf = LogisticRegression(multi_class='multinomial', solver='lbfgs', max_iter=1000, C=0.1)
clf.fit(X, y)

# Extract learned weights (compare to hand-tuned alpha, beta, etc.)
print("Feature weights:", clf.coef_)  # shape: (3, 5) — one set of weights per class
```

---

### Phase 3: Months 5–6 (Production Rollout)

**Validation Outcomes (assuming V2 wins on accuracy):**

1. **Update default model:**
   ```typescript
   // src/controllers/analyze.controller.ts
   const results = fetchedResults.map((item) => {
     if (item.ok) {
       // Use V2 as default
       return {
         ...toRepoAnalysisV2(item.data),
         // Include V1 for backward compatibility
         _legacy_v1: toRepoAnalysis(item.data),
       };
     }
     ...
   });
   ```

2. **API version bump:** `POST /analyze/v2` endpoint returns V2 scores exclusively; keep `/analyze` (v1) for legacy consumers.

3. **Frontend:**
   - Update display to show V2 difficulty, confidence, and feature decomposition
   - Add tooltip: "This difficulty rating is based on [X] key factors..."
   - Surface confidence (e.g., "85% confident this is Intermediate")

4. **Monitoring:**
   - Log feature importance distribution (which signals are most predictive?)
   - Track user feedback (do they find V2 more accurate?)
   - Set up alerts if V2 predictions diverge significantly from V1 (anomaly detection)

---

## Ground Truth Collection Campaign

### Strategy: Targeted Recruitment

**Channels:**
1. **GSoC Internships:** Direct recruitment from GSoC projects (they all work on OSS!)
2. **First-Time Contributors:** GitHub search for "first-time contributor" in commit messages
3. **Community Surveys:** Post on dev communities (dev.to, HackerNews, Reddit /r/openSource)
4. **Project Teams:** Reach out to project maintainers; ask them to survey recent newcomers

**Incentives:**
- Free access to VIP dashboard features (once productionized)
- Recognition in "Contributors to the Model" section of the project
- Optional: Monetary stipends ($10–20 Amazon gift cards)

**Survey Template:**

```markdown
## Open Source Newcomer Experience Survey

**Project:** <repo URL>
**Your Contribution:** <brief description of PR/issue submitted>

### Understanding the Project
**Q1:** On a scale of 1–10, how clear was the repository's **purpose and goals**?
(1 = Very unclear, 10 = Crystal clear)
**Answer:** ___

**Q2:** Was there a clear vision of the project's use cases?
- [ ] Yes, immediately obvious
- [ ] Kind of; I had to dig
- [ ] No clear direction

---

### Local Setup & Development Environment
**Q3:** On a scale of 1–10, how easy was it to **set up a local development environment**?
(1 = Nearly impossible, 10 = Trivial)
**Answer:** ___

**Q4:** Which of the following existed and helped?
- [ ] README with setup instructions
- [ ] docker-compose.yml
- [ ] Makefile or setup script
- [ ] CI/CD logs showing build steps
- [ ] None of the above

---

### Finding Contribution Opportunities
**Q5:** On a scale of 1–10, how easy was it to **find issues/PRs suited to your skill level**?
(1 = Impossible, 10 = Very clear pathways)
**Answer:** ___

**Q6:** Did the repo use labels like "good-first-issue" or "beginner-friendly"?
- [ ] Yes, and they were helpful
- [ ] Yes, but not really matched to difficulty
- [ ] No labels like that
- [ ] I didn't notice

---

### Understanding Contribution Guidelines
**Q7:** On a scale of 1–10, how clear were the **contribution guidelines**?
(1 = Non-existent, 10 = Step-by-step walkthrough)
**Answer:** ___

**Q8:** Which documents did the repo provide?
- [ ] CONTRIBUTING.md
- [ ] CODE_OF_CONDUCT.md
- [ ] PR template
- [ ] Issue template
- [ ] None of the above

---

### Community & Feedback Quality
**Q9:** On a scale of 1–10, how **welcoming and responsive** was the community?
(1 = Hostile/ignored, 10 = Extremely supportive)
**Answer:** ___

**Q10:** How long until someone responded to your PR/issue?
- [ ] < 1 hour
- [ ] < 1 day
- [ ] < 1 week
- [ ] > 1 week
- [ ] Still waiting

**Q11:** How would you rate the quality of feedback?
- [ ] Constructive, helpful, educational
- [ ] Neutral, pointing out issues
- [ ] Critical, harsh, dismissive
- [ ] Minimal feedback

---

### Overall Assessment
**Q12:** Overall, how would you rate **the difficulty for a newcomer**?
- [ ] **Beginner-Friendly** — Clear onboarding, strong support
- [ ] **Intermediate** — Some friction, but achievable with effort
- [ ] **Advanced** — High barrier; requires deep expertise
- [ ] **Unknown** — Too much variation; project-dependent

**Q13:** What was the **single biggest barrier** you encountered?
(Free-form text answer)

**Q14:** What was the **best part** of the onboarding experience?
(Free-form text answer)

---

Thank you for your feedback!
```

### Expected Response Rate & Timeline

- **Target:** 50–100 responses minimum
- **Timeline:** 4–6 weeks
- **Expected response rate:** 15–25% if recruiting via project maintainers; 5–10% if public surveys
- **Boost:** GSoC internships will guarantee 50+ if leveraged early

---

## Sensitivity Analysis

Once V2 is trained, conduct partial derivative analysis:

```python
import numpy as np
from scipy.optimize import minimize

def compute_feature_importance(repo_features, base_prediction):
    """
    For each feature, perturb it ±5% and measure change in P_advanced.
    Higher |change| = more important.
    """
    importance = {}
    base_P = base_prediction['advanced_probability']
    
    for feature_name in ['scale', 'friction', 'welcomingness', 'activity', 'ecosystem_adj']:
        perturbation = 0.05  # ±5% change
        
        # Increase feature
        features_up = repo_features.copy()
        features_up[feature_name] *= (1 + perturbation)
        P_up = scoreV2Model(features_up)['advanced_probability']
        
        # Decrease feature
        features_down = repo_features.copy()
        features_down[feature_name] *= (1 - perturbation)
        P_down = scoreV2Model(features_down)['advanced_probability']
        
        # Measure sensitivity = (ΔP / ΔX) averaged
        sensitivity = ((P_up - P_down) / (2 * perturbation * repo_features[feature_name])) if repo_features[feature_name] != 0 else 0
        importance[feature_name] = abs(sensitivity)
    
    return importance
```

**Expected Output:**
```
Feature Importance (ranked by |sensitivity|):
1. friction_score: 0.45
2. welcomingness_score: 0.38
3. activity_score: 0.25
4. scale_score: 0.15
5. ecosystem_adjustment: 0.08
```

This tells us: **Friction is the strongest predictor of difficulty.** If friction is uncertain, the whole prediction becomes uncertain.

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| **Ground Truth Accuracy** | V2 > 75% on labeled data | `sum(predictions == labels) / len(labels)` |
| **V2 vs V1 Improvement** | V2 > V1 + 5% | Run both models on same 50-label holdout; compare |
| **Feature Coverage** | ≥18 of 20 signals implemented | Count non-null fields in `v2_metrics` |
| **Confidence Calibration** | 80% confidence → 80% accuracy in that bin | Bin predictions by confidence; measure per-bin accuracy |
| **User Satisfaction** | Post-launch survey: "V2 is more useful" > 70% | Collect feedback from users |
| **Explainability** | Users can understand top 3 drivers | Usability test: "Why is this repo Advanced?" should be answerable in <1 min |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **V2 is less accurate than V1** | Fall back to V1 as default; use V2 as experimental endpoint only |
| **Labeling campaign gets <30 responses** | Use semi-supervised learning: train on unlabeled data using V1 as weak labels; refine with labeled subset |
| **New signals introduce major latency** | Batch-fetch signals using GraphQL; cache for 1 week; optionally defer low-importance signals |
| **Breaking change to API consumers** | Maintain `/analyze` (v1-compatible) alongside `/analyze/v2`; announce deprecation 6 months ahead |
| **Hyperparameter tuning overfits** | Use k-fold cross-validation (k=5); test on held-away data; apply L2 regularization |

---

## Summary

**Phase 1 (1–2 months):** Implement V2 signals and confidence quantification; deploy behind feature flag.

**Phase 2 (3–4 months):** Collect 50–100 ground truth labels; validate V2 accuracy vs V1; tune hyperparameters if needed.

**Phase 3 (5–6 months):** Roll out V2 as default if accuracy improves; monitor feature importance; gather user feedback.

**Expected Outcome:** A more accurate, interpretable, and confident difficulty prediction that helps newcomers and projects alike.

