from __future__ import annotations

from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional


class AnalyzeRequest(BaseModel):
    repos: list[str]
    github_token: Optional[str] = None

    @field_validator("repos")
    @classmethod
    def validate_repos(cls, repos: list[str]) -> list[str]:
        import re
        pattern = re.compile(r"^https://github\.com/[\w.\-]+/[\w.\-]+/?$")
        invalid = [r for r in repos if not pattern.match(r.strip())]
        if invalid:
            raise ValueError(
                f"Invalid GitHub URLs: {invalid}. "
                "Expected format: https://github.com/owner/repo"
            )
        return [r.rstrip("/") for r in repos]


class RepoAnalysis(BaseModel):
    repo: str
    url: str
    stars: Optional[int] = None
    forks: Optional[int] = None
    open_issues: Optional[int] = None
    primary_language: Optional[str] = None
    languages: dict[str, float] = {}
    contributors_count: Optional[int] = None
    commits_last_90d: Optional[int] = None
    closed_issues_last_90d: Optional[int] = None
    releases_last_year: Optional[int] = None
    days_since_last_commit: Optional[int] = None
    file_count: Optional[int] = None
    folder_depth: Optional[int] = None
    has_dependency_file: Optional[bool] = None
    language_count: Optional[int] = None
    activity_score: Optional[int] = None
    complexity_score: Optional[int] = None
    difficulty: str = "Unknown"
    notes: list[str] = []
    data_quality: str = "complete"
    error: Optional[str] = None


class AnalysisResponse(BaseModel):
    analyzed_at: str
    total: int
    results: list[RepoAnalysis]
