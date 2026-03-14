from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from cachetools import TTLCache

# 1-hour cache: key = (owner, repo, endpoint_suffix)
_cache: TTLCache = TTLCache(maxsize=1000, ttl=3600)

GITHUB_API = "https://api.github.com"
DEPENDENCY_FILES = {
    "package.json", "requirements.txt", "pipfile", "pom.xml",
    "build.gradle", "gemfile", "go.mod", "cargo.toml",
    "composer.json", ".csproj", "pyproject.toml", "setup.py",
}

# Concurrency guard — max 5 simultaneous GitHub requests
_semaphore = asyncio.Semaphore(5)


def _build_headers(token: Optional[str]) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    elif os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.getenv('GITHUB_TOKEN')}"
    return headers


async def _get(
    client: httpx.AsyncClient,
    path: str,
    token: Optional[str],
    params: Optional[dict] = None,
) -> tuple[Optional[dict | list], dict]:
    """Fetch a single GitHub API endpoint. Returns (data, headers)."""
    cache_key = (path, str(params))
    if cache_key in _cache:
        return _cache[cache_key], {}

    async with _semaphore:
        try:
            resp = await client.get(
                f"{GITHUB_API}{path}",
                headers=_build_headers(token),
                params=params,
                timeout=15.0,
            )
        except httpx.TimeoutException:
            return None, {}

    if resp.status_code == 404:
        return None, resp.headers  # type: ignore[return-value]
    if resp.status_code == 403 or resp.status_code == 429:
        # Rate limited — raise so caller can surface partial results
        raise RateLimitError(
            resp.headers.get("X-RateLimit-Reset", "unknown"),
            int(resp.headers.get("X-RateLimit-Remaining", 0)),
        )
    if resp.status_code != 200:
        return None, resp.headers  # type: ignore[return-value]

    data = resp.json()
    _cache[cache_key] = data
    return data, resp.headers  # type: ignore[return-value]


class RateLimitError(Exception):
    def __init__(self, reset_at: str, remaining: int):
        self.reset_at = reset_at
        self.remaining = remaining
        super().__init__(f"Rate limit exhausted. Resets at {reset_at}.")


async def fetch_repo_data(
    owner: str,
    name: str,
    token: Optional[str],
    client: httpx.AsyncClient,
) -> dict:
    """Fetch all data needed for scoring a single repository."""
    ninety_days_ago = (
        datetime.now(timezone.utc) - timedelta(days=90)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")
    one_year_ago = (
        datetime.now(timezone.utc) - timedelta(days=365)
    ).strftime("%Y-%m-%dT%H:%M:%SZ")

    base = f"/repos/{owner}/{name}"

    # Parallel fetch: metadata, languages, commits, issues, releases, tree
    results = await asyncio.gather(
        _get(client, base, token),
        _get(client, f"{base}/languages", token),
        _get(client, f"{base}/commits", token, {"since": ninety_days_ago, "per_page": 100}),
        _get(client, f"{base}/issues", token, {"state": "closed", "since": ninety_days_ago, "per_page": 100}),
        _get(client, f"{base}/releases", token, {"per_page": 100}),
        _get(client, f"{base}/contributors", token, {"per_page": 1, "anon": "false"}),
        _get(client, f"{base}/git/trees/HEAD", token, {"recursive": "1"}),
        return_exceptions=True,
    )

    meta_data, _ = results[0] if not isinstance(results[0], Exception) else (None, {})
    lang_data, _ = results[1] if not isinstance(results[1], Exception) else (None, {})
    commit_data, commit_headers = results[2] if not isinstance(results[2], Exception) else (None, {})
    issue_data, _ = results[3] if not isinstance(results[3], Exception) else (None, {})
    release_data, _ = results[4] if not isinstance(results[4], Exception) else (None, {})
    contrib_data, contrib_headers = results[5] if not isinstance(results[5], Exception) else (None, {})
    tree_data, _ = results[6] if not isinstance(results[6], Exception) else (None, {})

    # Contributor count via Link header (avoids paginating large lists)
    contributor_count = _parse_last_page(contrib_headers) * 1  # each page = 1 result
    if contributor_count == 0 and isinstance(contrib_data, list):
        contributor_count = len(contrib_data)

    # Commits: count from page (capped estimate)
    commits_90d = len(commit_data) if isinstance(commit_data, list) else 0

    # Releases in last year
    releases_1yr = 0
    if isinstance(release_data, list):
        for rel in release_data:
            pub = rel.get("published_at", "")
            if pub and pub >= one_year_ago:
                releases_1yr += 1

    # Closed issues last 90 days
    closed_issues_90d = len(issue_data) if isinstance(issue_data, list) else 0

    # File tree analysis
    file_count = 0
    max_depth = 0
    has_dep_file = False
    if isinstance(tree_data, dict) and "tree" in tree_data:
        for entry in tree_data["tree"]:
            if entry.get("type") == "blob":
                file_count += 1
                path: str = entry.get("path", "")
                depth = path.count("/") + 1
                max_depth = max(max_depth, depth)
                if path.lower().split("/")[-1] in DEPENDENCY_FILES:
                    has_dep_file = True

    # Language breakdown (bytes → percent)
    lang_pct: dict[str, float] = {}
    if isinstance(lang_data, dict) and lang_data:
        total_bytes = sum(lang_data.values())
        lang_pct = {
            lang: round(bytes_ / total_bytes * 100, 1)
            for lang, bytes_ in lang_data.items()
        }

    # Days since last commit
    days_since = None
    if meta_data and meta_data.get("pushed_at"):
        last_push = datetime.fromisoformat(
            meta_data["pushed_at"].replace("Z", "+00:00")
        )
        days_since = (datetime.now(timezone.utc) - last_push).days

    return {
        "meta": meta_data,
        "languages": lang_pct,
        "language_count": len(lang_pct),
        "commits_last_90d": commits_90d,
        "closed_issues_last_90d": closed_issues_90d,
        "releases_last_year": releases_1yr,
        "contributors_count": contributor_count,
        "file_count": file_count,
        "folder_depth": max_depth,
        "has_dependency_file": has_dep_file,
        "days_since_last_commit": days_since,
    }


def _parse_last_page(headers: dict) -> int:
    """Extract total page count from GitHub Link header."""
    link = headers.get("link", "") if isinstance(headers, dict) else ""
    if not link or 'rel="last"' not in link:
        return 1
    import re
    match = re.search(r'page=(\d+)>; rel="last"', link)
    return int(match.group(1)) if match else 1
