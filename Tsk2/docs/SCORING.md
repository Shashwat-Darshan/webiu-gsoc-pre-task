# Scoring Model (Final Production Spec)

Consolidation note:

This document supersedes and replaces all previous scoring drafts in this task folder.

## Model Version

Default classifier: `model-b-v2` (confidence-weighted)

Alternate scaffold: `model-a-v1` (rules-based strategy)

This document is the implementation source of truth for Task 2 scoring.

## Inputs

From GitHub API + derived metrics:

- `stars`
- `contributorsCount`
- `commitsLast90d`
- `closedIssuesLast90d`
- `releasesLastYear`
- `fileCount` (filtered tree)
- `folderDepth` (filtered tree)
- `daysSinceLastCommit`
- `healthPercentage` (community profile)
- `goodFirstIssuesCount` (fresh issues in last 90 days)
- `issueClosureRate`
- `primaryLanguage`
- `hasDependencyFile`
- `languageCount`
- `dataQuality`

## Normalization

Power-law scaling:

`log_norm(x, m) = clamp(log10(x + 1) / log10(m + 1), 0, 1)`

## Sub-Scores

Scale (`S`):

`S = 0.20*log_norm(stars,10000) + 0.35*log_norm(contributors,1000) + 0.45*log_norm(commits90d,1000)`

Friction (`F`):

`F = 0.60*log_norm(fileCount,5000) + 0.20*log_norm(folderDepth,12) + 0.20*staleness`

Where `staleness = clamp(daysSinceLastCommit/365,0,1)`

Welcomingness (`W`):

`W = 0.50*(healthPercentage/100) + 0.30*log_norm(freshGfi,50) + 0.20*issueClosureRate`

Activity momentum (`A`):

`A = 0.35*log_norm(commits90d,500) + 0.20*log_norm(closedIssues90d,200) + 0.15*log_norm(releasesLastYear,24) + 0.20*(1-staleness) + 0.10*issueClosureRate`

## Adjustment Terms

Ecosystem adjustment (`E`) scales raw difficulty by language/setup context:

- Base multipliers by primary language family:
	- Beginner-friendly (`javascript`, `typescript`, `python`, `go`): `0.95`
	- Moderate (`java`, `c#`, `kotlin`, `php`, `ruby`): `1.00`
	- Steeper (`c++`, `rust`, `swift`, `scala`): `1.08`
	- Other/unknown: `1.02`
- Setup multiplier: `1.00` if dependency file exists, else `1.05`
- Language spread penalty: `clamp((languageCount - 8)/20, 0, 0.08)`
- Final clamp: `E = clamp(base * setupMultiplier - spreadPenalty, 0.85, 1.15)`

Data reliability penalty (`Q`) from `dataQuality`:

- `complete: 0.00`
- `partial: 0.03`
- `partial_search: 0.05`
- `partial_tree: 0.06`
- `degraded: 0.12`
- `unavailable: 0.20`

## Advanced Probability

Raw model core:

`D_core = 0.55*F - 1.45*W - 0.22*S + 0.35*(1-A)`

Adjusted difficulty:

`D_adj = D_core*E + 0.40*Q`

Sigmoid probability:

`P_advanced = 1 / (1 + exp(-3.4*(D_adj - 0.26)))`

## Decision Boundaries

- Beginner: `P_advanced < 0.35` AND not stale-lock
- Intermediate: `0.35 <= P_advanced <= 0.70`
- Advanced: `P_advanced > 0.70`

Stale-lock guardrail:

- If `daysSinceLastCommit > 90`, Beginner is downgraded to Intermediate.

Mega-complexity guardrail:

- If `P_advanced < 0.35` but repository surface area is very large (`file_count >= 10000` or large-tree fallback signals), and both friction and scale are high, Beginner is upgraded to Intermediate.

## Outcome Interpretation

<details>
<summary><b>Click to view/hide outcome interpretation details</b></summary>
<br>

### Difficulty label meaning

- `Beginner`: Lower advanced-risk probability and supportive onboarding/community signals.
- `Intermediate`: Mixed signals (some friction or weaker momentum) with moderate onboarding complexity.
- `Advanced`: Friction/momentum risk dominates welcoming and scale offsets.
- `Unknown`: Returned only for upstream fetch failure cases outside successful scoring flow.

### Confidence interpretation bands

- `< 0.20`: Very likely Beginner profile.
- `0.20 to 0.35`: Lean Beginner but sensitive to staleness and data quality.
- `0.35 to 0.70`: Intermediate corridor.
- `> 0.70`: Strong Advanced signal.

These bands interpret the `confidence_score` field, which is `P_advanced`.

### One-glance summary combinations (UI)

The UI summary text uses threshold combinations with strict precedence:

- High thresholds: `activity/complexity/onboarding >= 70`
- Low thresholds: `0 < activity/complexity/onboarding <= 35`

Rule order and possible outputs:

1. `complexity high` AND `onboarding high` -> difficulty-aware summary:
	- `Intermediate`: `Large and complex, but onboarding support keeps it in a manageable intermediate range.`
	- `Beginner` with elevated confidence (`>= 0.25`): `Complex and well-guided, but still carries moderate newcomer ramp-up risk.`
	- otherwise: `Complex but newcomer-friendly with strong guidance and support paths.`
2. `complexity high` AND `onboarding low` -> `Complex and newcomer-challenging with limited onboarding guidance.`
3. `complexity low` AND `onboarding high` -> `Simple structure and beginner-friendly contribution path.`
4. `difficulty = Beginner` -> `Beginner-friendly contribution path with manageable onboarding friction.`
5. `difficulty = Intermediate` -> `Moderate complexity with a manageable learning curve.`
6. `activity low` -> `Beginner path may be slower due to low recent project activity.`
7. Else -> `Complex setup expected due to project scale or structural friction.`

Error override:

- If `error` exists or `difficulty = Unknown` -> `Insufficient data to estimate newcomer friendliness.`

### Onboarding effort label mapping (UI)

- `Beginner` -> `Beginner-friendly`
- `Intermediate` -> `Moderate complexity with guidance needed`
- `Advanced` -> `Complex and newcomer-challenging`
- `Unknown` -> `Insufficient data`

</details>

## Activity and Complexity Output Fields

- `activity_score = round(A * 100)`
- `complexity_score = round(F * 100)`

`confidence_score` is the model probability `P_advanced` rounded to 4 decimals.

## Complexity Extraction Rules

Tree-based complexity excludes noise paths:

- `node_modules/`, `vendor/`, `dist/`, `build/`, `out/`, `coverage/`, `.next/`, `.nuxt/`, `target/`
- `docs/`, `doc/`
- `*.min.js`, `*.min.css`
- lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`)
- markdown files (`*.md`)

Large tree fallback:

- If `sizeKb >= 500000` or recursive tree request times out, fallback estimation is used for tree metrics and contributes to data-quality downgrade.

## Resilience and Data Quality

Data quality states:

- `complete`
- `partial`
- `partial_search`
- `partial_tree`
- `degraded`
- `unavailable`

State logic:

- Search-only degradation -> `partial_search`
- Tree-only degradation -> `partial_tree`
- Search + tree degradation -> `degraded`
- Other partial source degradation -> `partial`

## Explainability Contract

Each successful result includes:

- `rationale`
- `top_positive_drivers[]`
- `top_friction_drivers[]`

Driver generation prioritizes onboarding signals, scale/complexity pressures, maintenance momentum, setup clarity, and data quality constraints.

## Recommended Reporting Fields

<details>
<summary><b>Click to view/hide recommended reporting fields</b></summary>
<br>

For each analyzed repository, surface this compact explanation bundle:

- Classification: `difficulty`, `confidence_score`, `model_version`
- Core dimensions: `activity_score`, `complexity_score`, `onboarding_health_score`
- Freshness and maintenance: `commits_last_90d`, `closed_issues_last_90d`, `releases_last_year`, `days_since_last_commit`
- Community and discoverability: `good_first_issues_count`, `issue_closure_rate`, `contributors_count`
- Scope signals: `file_count`, `folder_depth`, `language_count`, `primary_language`
- Reliability context: `data_quality`
- Explainability: `rationale`, top positive and friction drivers
- Notes: `notes[]` (guardrails, fallback explanations, caveats)

This set gives enough context to justify outcomes such as "complex but beginner-friendly" without overwhelming users.

</details>

## Roadmap (Next Iteration)

The following enhancements were retained from the older proposal docs and are intentionally tracked here as future work:

- Add PR review velocity and issue first-response latency as explicit metrics.
- Add newcomer governance signals such as `CONTRIBUTING.md`, `CODE_OF_CONDUCT`, and issue templates.
- Add temporal trend features (30d vs 90d acceleration for commits, contributor acquisition trend).
- Add dependency freshness and CI activity signals.
- Add confidence calibration against labeled newcomer feedback and report interval-style certainty.
- Add optional `difficulty_next` experimental output behind a feature flag while preserving stable `difficulty`.

These items are not part of the current production classifier unless implemented in code and reflected in this spec.
