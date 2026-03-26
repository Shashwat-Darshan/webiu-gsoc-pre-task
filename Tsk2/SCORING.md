# Scoring Model (Current)

## Model Version

Default classifier: `model-b-v1` (confidence-weighted)

Alternate scaffold: `model-a-v1` (rules-based strategy)

## Inputs

From GitHub API + derived metrics:

- `stars`
- `contributorsCount`
- `commitsLast90d`
- `fileCount` (filtered tree)
- `folderDepth` (filtered tree)
- `daysSinceLastCommit`
- `healthPercentage` (community profile)
- `goodFirstIssuesCount` (fresh issues in last 90 days)
- `issueClosureRate`

## Normalization

Power-law scaling:

`log_norm(x, m) = clamp(log10(x + 1) / log10(m + 1), 0, 1)`

## Sub-Scores

Scale:

`S = 0.20*log_norm(stars,10000) + 0.35*log_norm(contributors,1000) + 0.45*log_norm(commits90d,1000)`

Friction:

`F = 0.60*log_norm(fileCount,5000) + 0.20*log_norm(folderDepth,12) + 0.20*staleness`

Where `staleness = clamp(daysSinceLastCommit/365,0,1)`

Welcomingness:

`W = 0.50*(healthPercentage/100) + 0.30*log_norm(freshGfi,50) + 0.20*issueClosureRate`

## Advanced Probability

`D_raw = F - (W * alpha) - (S * beta)`

`P_advanced = 1 / (1 + exp(-k*(D_raw - tau)))`

Current constants:

- `alpha = 1.5`
- `beta = 0.2`
- `k = 4.0`
- `tau = 0.2`

## Decision Boundaries

- Beginner: `P_advanced < 0.35` AND not stale-lock
- Intermediate: `0.35 <= P_advanced <= 0.70`
- Advanced: `P_advanced > 0.70`

Stale-lock guardrail:

- If `daysSinceLastCommit > 90`, Beginner is downgraded to Intermediate.

## Complexity Extraction Rules

Tree-based complexity excludes noise paths:

- `node_modules/`, `vendor/`, `dist/`, `build/`, `out/`, `coverage/`, `.next/`, `.nuxt/`, `target/`
- `docs/`, `doc/`
- `*.min.js`, `*.min.css`
- lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`)
- markdown files (`*.md`)

## Resilience and Data Quality

Data quality states:

- `complete`
- `partial`
- `partial_search`
- `partial_tree`
- `degraded`
- `unavailable`

Fallback behavior:

- Search failures can produce `partial_search`
- Tree timeout/size fallback can produce `partial_tree`
- Both together produce `degraded`

Large tree fallback:

- If repo size is very large (`sizeKb >= 500000`) or tree request times out, heuristic complexity fallback is used.

## Explainability Contract

Each result includes:

- `rationale`
- `top_positive_drivers[]`
- `top_friction_drivers[]`

## Notes

Legacy OR-gate (`activity >= 70 OR complexity >= 70`) is no longer used in default model.
