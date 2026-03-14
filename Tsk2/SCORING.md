# Scoring Formulas, Assumptions & Limitations

## Data Collected per Repository

All data is fetched from the **GitHub REST API v3** (authenticated):

| GitHub Endpoint | Data Extracted |
|----------------|----------------|
| `GET /repos/{owner}/{repo}` | stars, forks, open_issues, language, description, pushed_at, size |
| `GET /repos/{owner}/{repo}/commits?since=90d` | commit count in last 90 days (capped at 100 fetched, estimated from pagination) |
| `GET /repos/{owner}/{repo}/contributors?per_page=1` (check `Link` header) | total contributor count |
| `GET /repos/{owner}/{repo}/languages` | language → bytes map |
| `GET /repos/{owner}/{repo}/releases?per_page=100` | count of releases in last 365 days |
| `GET /repos/{owner}/{repo}/issues?state=closed&since=90d` | closed issues in last 90 days |
| `GET /repos/{owner}/{repo}/git/trees/HEAD?recursive=1` | file count, max folder depth |

---

## Activity Score Formula

**Purpose**: Measure how actively maintained a repository is right now.

### Raw Inputs

| Variable | Source | Weight Rationale |
|----------|--------|-----------------|
| `C` = commits last 90 days | `/commits?since=` | Direct signal of active development |
| `CT` = total contributor count | `/contributors` header | More contributors = more community activity |
| `I` = closed issues last 90 days | `/issues?state=closed` | Maintainers responding to problems |
| `R` = releases in last 12 months | `/releases` | Formal output signal |
| `D` = days since last commit | `pushed_at` field | Recency penalty |

### Formula

```
activity_raw = (
    min(C, 200)  * 0.35    +   # commits, capped at 200 to avoid skew
    min(CT, 100) * 0.25    +   # contributors, capped at 100
    min(I, 100)  * 0.20    +   # closed issues, capped at 100
    min(R, 24)   * 0.10    +   # releases, capped at 24 (biweekly)
    staleness_penalty        *   0.10
)

staleness_penalty = max(0, 1 - (D / 365))
# = 1.0 if committed today, 0.0 if last commit > 1 year ago

activity_score = round(normalize(activity_raw, min=0, max=expected_max) * 100)
```

**`expected_max`** is calibrated against real repos:
- Highly active (e.g., `nestjs/nest`): raw ≈ 85
- Moderately active (e.g., small GSoC projects): raw ≈ 30

`normalize(x, min, max) = (x - min) / (max - min)` clamped to [0, 1].

### Examples

| Repo | C | CT | I | R | D | Activity Score |
|------|---|----|---|---|---|---------------|
| `nestjs/nest` | 312 | 450 | 87 | 18 | 1 | 94 |
| `c2siorg/Webiu` | 45 | 28 | 12 | 3 | 7 | 61 |
| Abandoned repo | 0 | 5 | 0 | 0 | 700 | 3 |

---

## Complexity Score Formula

**Purpose**: Estimate how complex the codebase is to understand and contribute to.

### Raw Inputs

| Variable | Source | Weight Rationale |
|----------|--------|-----------------|
| `F` = total file count | git tree | More files = more surface area |
| `L` = number of distinct languages | `/languages` | Polyglot repos require broader knowledge |
| `DEP` = has dependency manifest | file tree scan | package.json / requirements.txt / pom.xml etc. indicate real project complexity |
| `FD` = max folder depth | git tree | Deep nesting signals architectural complexity |
| `SIZE` = repo size (KB) | `size` field | Proxy for lines-of-code |

### Formula

```
complexity_raw = (
    min(F, 5000)   / 5000  * 30    +   # file count, 30 points max
    min(L, 6)      / 6     * 20    +   # language diversity, 20 points max  
    DEP            * 15            +   # binary: has dependency file
    min(FD, 10)    / 10    * 20    +   # folder depth, 20 points max
    min(SIZE, 50000) / 50000 * 15      # repo size, 15 points max
)

complexity_score = round(complexity_raw)  # already 0-100
```

**Dependency file detector**: presence of any of:
`package.json`, `requirements.txt`, `Pipfile`, `pom.xml`, `build.gradle`,
`Gemfile`, `go.mod`, `Cargo.toml`, `composer.json`, `.csproj`

### Examples

| Repo | F | L | DEP | FD | SIZE(KB) | Complexity Score |
|------|---|---|-----|----|---------|-----------------|
| `nestjs/nest` | 2840 | 2 | yes | 7 | 28000 | 81 |
| `c2siorg/Webiu` | 180 | 4 | yes | 5 | 4500 | 47 |
| Simple script repo | 3 | 1 | no | 1 | 12 | 4 |

---

## Learning Difficulty Classification

```
if activity_score >= 70 OR complexity_score >= 70:
    difficulty = "Advanced"
elif activity_score >= 35 OR complexity_score >= 35:
    difficulty = "Intermediate"
else:
    difficulty = "Beginner"
```

**Rationale**:
- A highly active repo is "Advanced" because new contributors must navigate fast-moving
  code, many open PRs, and high-volume review cycles.
- A complex codebase is "Advanced" regardless of activity level because onboarding
  requires understanding a large, multi-layered system.
- Both dimensions are evaluated with OR to be conservative — one hard axis is enough
  to raise the classification.

---

## Edge Case Handling

| Scenario | Handling |
|----------|---------|
| Empty repository (0 commits, 0 files) | All inputs = 0; scores = 0; difficulty = "Beginner"; note: "Empty or uninitialized repository" |
| Private / 404 repository | Return `error` field; scores = null; data_quality = "unavailable" |
| GitHub API rate limit hit | Respect `Retry-After`; return partial results already computed; note remaining repos could not be analyzed |
| Repository with no releases | R = 0; no penalty, just contributes 0 to activity |
| Repository with no contributors endpoint (e.g., fork with single commit) | CT = stars > 0 → estimate CT = 1; note "contributor count estimated" |
| Repository size = 0 (bare / LFS) | SIZE contribution = 0 in formula; note "size data unavailable" |
| Invalid URL format | Validate on input with regex; return 422 Unprocessable Entity with clear message |

---

## Rate Limit Strategy

- **Unauthenticated**: 60 req/hr — analyze ~4 repos at 15 calls each.
- **Authenticated PAT**: 5,000 req/hr — analyze ~333 repos.
- Implementation:
  1. Check `X-RateLimit-Remaining` after each request.
  2. If < 50 remaining, stop fetching and return partial results with a warning.
  3. Cache each repo's response for 60 minutes (TTLCache) — repeat analyses of the same
     repo within the hour cost 0 additional API calls.
  4. Concurrent analysis: repos fetched with `asyncio.gather` but capped at 5 concurrent
     requests to avoid triggering GitHub's secondary rate limits.

---

## Assumptions

1. "Commits last 90 days" is fetched by paginating `/commits?since=` up to 3 pages
   (max 300); if more, the count is marked as "300+" and capped at 200 in the formula.
2. Contributor count is estimated from the `Link` header `last` page number × 30
   when the list is too large to fully paginate within rate limits.
3. Folder depth is computed on the flat tree returned by the recursive git tree endpoint;
   it is the maximum slash-count across all blob paths.
4. Language weights (bytes → percentage) are normalized to sum to 100%.
5. The `expected_max` normalization constants in the activity formula are calibrated
   against a reference set of 20 repos spanning beginner to advanced — they may need
   recalibration if applied to unusual repo types (e.g., data-only repos).

---

## Limitations

- Stars are a vanity metric and deliberately excluded from scoring formulas (they reflect
  popularity, not activity or complexity). They are reported but not weighted.
- Issue count alone is an imperfect complexity signal — a well-run repo may have few
  open issues despite high complexity. For this reason, issue data only contributes to
  activity, not complexity.
- The tool cannot access private repositories without a token that has `repo` scope.
- Language byte counts from GitHub may not reflect logical line-of-code counts
  (e.g., minified JS inflates byte count).
- Fork counts can reflect external popularity inflated by GitHub Archive programs;
  they are reported but not used in scoring.
