from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from github_client import RateLimitError, fetch_repo_data
from models import AnalysisResponse, AnalyzeRequest, RepoAnalysis
from scorer import activity_score, classify_difficulty, complexity_score, generate_notes

app = FastAPI(
    title="GitHub Repository Intelligence Analyzer",
    description=(
        "Analyzes GitHub repositories and generates activity, complexity, "
        "and learning difficulty scores."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production to your frontend domain
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: AnalyzeRequest) -> AnalysisResponse:
    token = request.github_token or os.getenv("GITHUB_TOKEN")

    async with httpx.AsyncClient() as client:
        tasks = [
            _analyze_single(url, token, client)
            for url in request.repos
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    analyzed: list[RepoAnalysis] = []
    for url, result in zip(request.repos, results):
        if isinstance(result, RepoAnalysis):
            analyzed.append(result)
        elif isinstance(result, RateLimitError):
            # Surface rate-limit error as a partial result
            parts = _parse_url(url)
            analyzed.append(
                RepoAnalysis(
                    repo=f"{parts[0]}/{parts[1]}" if parts else url,
                    url=url,
                    error=f"GitHub rate limit exhausted. Resets at {result.reset_at}.",
                    data_quality="unavailable",
                )
            )
        else:
            parts = _parse_url(url)
            analyzed.append(
                RepoAnalysis(
                    repo=f"{parts[0]}/{parts[1]}" if parts else url,
                    url=url,
                    error=str(result) if result else "Unknown error",
                    data_quality="unavailable",
                )
            )

    return AnalysisResponse(
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        total=len(analyzed),
        results=analyzed,
    )


async def _analyze_single(
    url: str,
    token: Optional[str],
    client: httpx.AsyncClient,
) -> RepoAnalysis:
    parts = _parse_url(url)
    if not parts:
        raise ValueError(f"Could not parse repo URL: {url}")
    owner, name = parts

    data = await fetch_repo_data(owner, name, token, client)
    meta = data.get("meta")

    if meta is None:
        return RepoAnalysis(
            repo=f"{owner}/{name}",
            url=url,
            error="Repository not found or private",
            data_quality="unavailable",
        )

    act = activity_score(
        commits_90d=data.get("commits_last_90d"),
        contributors=data.get("contributors_count"),
        closed_issues_90d=data.get("closed_issues_last_90d"),
        releases_1yr=data.get("releases_last_year"),
        days_since_last_commit=data.get("days_since_last_commit"),
    )

    cplx = complexity_score(
        file_count=data.get("file_count"),
        language_count=data.get("language_count"),
        has_dependency_file=data.get("has_dependency_file"),
        folder_depth=data.get("folder_depth"),
        repo_size_kb=meta.get("size"),
    )

    difficulty = classify_difficulty(act, cplx)
    notes = generate_notes(data, act, cplx)

    return RepoAnalysis(
        repo=f"{owner}/{name}",
        url=url,
        stars=meta.get("stargazers_count"),
        forks=meta.get("forks_count"),
        open_issues=meta.get("open_issues_count"),
        primary_language=meta.get("language"),
        languages=data.get("languages", {}),
        contributors_count=data.get("contributors_count"),
        commits_last_90d=data.get("commits_last_90d"),
        closed_issues_last_90d=data.get("closed_issues_last_90d"),
        releases_last_year=data.get("releases_last_year"),
        days_since_last_commit=data.get("days_since_last_commit"),
        file_count=data.get("file_count"),
        folder_depth=data.get("folder_depth"),
        has_dependency_file=data.get("has_dependency_file"),
        language_count=data.get("language_count"),
        activity_score=act,
        complexity_score=cplx,
        difficulty=difficulty,
        notes=notes,
        data_quality="complete" if data.get("file_count") else "partial",
    )


def _parse_url(url: str) -> Optional[tuple[str, str]]:
    """Extract (owner, name) from https://github.com/owner/name"""
    try:
        parts = url.rstrip("/").split("github.com/")[1].split("/")
        return parts[0], parts[1]
    except (IndexError, AttributeError):
        return None
