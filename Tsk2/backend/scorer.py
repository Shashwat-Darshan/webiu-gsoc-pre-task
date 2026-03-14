from __future__ import annotations

from typing import Optional


# ─── Activity Score ────────────────────────────────────────────────────────────
# Scale: 0–100
# Weights: commits 35%, contributors 25%, closed issues 20%, releases 10%, staleness 10%

ACTIVITY_EXPECTED_MAX = 85.0  # calibrated against high-activity reference repos


def activity_score(
    commits_90d: Optional[int],
    contributors: Optional[int],
    closed_issues_90d: Optional[int],
    releases_1yr: Optional[int],
    days_since_last_commit: Optional[int],
) -> int:
    C = min(commits_90d or 0, 200)
    CT = min(contributors or 0, 100)
    I = min(closed_issues_90d or 0, 100)
    R = min(releases_1yr or 0, 24)
    D = days_since_last_commit if days_since_last_commit is not None else 365
    staleness = max(0.0, 1.0 - (D / 365))

    raw = (
        (C / 200) * 35 +
        (CT / 100) * 25 +
        (I / 100) * 20 +
        (R / 24) * 10 +
        staleness * 10
    )
    # normalize to 0–100
    normalized = min(raw / ACTIVITY_EXPECTED_MAX, 1.0) * 100
    return round(normalized)


# ─── Complexity Score ──────────────────────────────────────────────────────────
# Scale: 0–100
# Weights: files 30%, languages 20%, dependency 15%, folder depth 20%, size 15%

def complexity_score(
    file_count: Optional[int],
    language_count: Optional[int],
    has_dependency_file: Optional[bool],
    folder_depth: Optional[int],
    repo_size_kb: Optional[int],
) -> int:
    F = min(file_count or 0, 5000)
    L = min(language_count or 0, 6)
    DEP = 1 if has_dependency_file else 0
    FD = min(folder_depth or 0, 10)
    SIZE = min(repo_size_kb or 0, 50000)

    score = (
        (F / 5000) * 30 +
        (L / 6) * 20 +
        DEP * 15 +
        (FD / 10) * 20 +
        (SIZE / 50000) * 15
    )
    return round(min(score, 100))


# ─── Difficulty Classification ─────────────────────────────────────────────────

def classify_difficulty(act: Optional[int], cplx: Optional[int]) -> str:
    if act is None or cplx is None:
        return "Unknown"
    if act >= 70 or cplx >= 70:
        return "Advanced"
    if act >= 35 or cplx >= 35:
        return "Intermediate"
    return "Beginner"


# ─── Notes Generator ────────────────────────────────────────────────────────────

def generate_notes(data: dict, act: Optional[int], cplx: Optional[int]) -> list[str]:
    notes = []
    commits = data.get("commits_last_90d", 0) or 0
    contributors = data.get("contributors_count", 0) or 0
    langs = data.get("language_count", 0) or 0
    depth = data.get("folder_depth", 0) or 0
    days = data.get("days_since_last_commit")
    releases = data.get("releases_last_year", 0) or 0
    files = data.get("file_count", 0) or 0

    if commits >= 100:
        notes.append(f"Very high commit frequency ({commits} commits in 90 days)")
    elif commits >= 30:
        notes.append(f"Moderate commit activity ({commits} commits in 90 days)")
    elif commits == 0:
        notes.append("No commits in the last 90 days")

    if contributors >= 50:
        notes.append(f"Large contributor base ({contributors} contributors)")
    elif contributors >= 10:
        notes.append(f"Active contributor community ({contributors} contributors)")

    if releases >= 12:
        notes.append(f"Frequent releases ({releases} in the past year)")

    if langs >= 3:
        notes.append(f"Multi-language codebase ({langs} languages)")

    if depth >= 6:
        notes.append(f"Deep folder structure (max depth {depth})")

    if files >= 1000:
        notes.append(f"Large codebase ({files:,} files)")

    if days is not None and days > 180:
        notes.append(f"Low recent activity — last commit {days} days ago")

    if data.get("has_dependency_file"):
        notes.append("Has dependency manifest (real project with managed dependencies)")

    if not notes:
        notes.append("Limited data available for detailed analysis")

    return notes
