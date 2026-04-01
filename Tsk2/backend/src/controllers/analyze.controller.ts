import { Request, Response } from "express";
import { env } from "../config/env";
import { AnalyzeRequest, AnalyzeResponse, RepoAnalysis } from "../models/repo.model";
import { GitHubService } from "../services/github.service";
import { toRepoAnalysis } from "../services/scorer.service";

const githubService = new GitHubService({
  defaultToken: env.githubToken,
  requestTimeoutMs: env.githubRequestTimeoutMs,
  treeTimeoutMs: env.githubTreeTimeoutMs,
  cacheTtlMs: env.githubCacheTtlMs,
  cacheMaxEntries: env.githubCacheMaxEntries,
  concurrencyLimit: env.githubConcurrencyLimit,
  rateLimitStopThreshold: env.githubRateLimitStopThreshold
});

function isAnalyzeRequestBody(payload: unknown): payload is AnalyzeRequest {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const maybe = payload as AnalyzeRequest;
  return Array.isArray(maybe.repos);
}

export async function analyzeRepositories(req: Request, res: Response): Promise<void> {
  if (!isAnalyzeRequestBody(req.body)) {
    res.status(422).json({ detail: "Request body must include repos: string[]" });
    return;
  }

  const { repos, github_token } = req.body;

  if (repos.length === 0) {
    res.status(422).json({ detail: "At least one repository URL is required" });
    return;
  }

  if (!repos.every((repo) => typeof repo === "string")) {
    res.status(422).json({ detail: "All repos entries must be strings" });
    return;
  }

  const fetchedResults = await githubService.fetchMany(repos, github_token);

  const results: RepoAnalysis[] = fetchedResults.map((item) => {
    if (item.ok) {
      return toRepoAnalysis(item.data);
    }

    return {
      repo: item.error.repo,
      url: item.error.url,
      stars: 0,
      forks: 0,
      open_issues: 0,
      primary_language: null,
      languages: {},
      contributors_count: 0,
      commits_last_90d: 0,
      closed_issues_last_90d: 0,
      issue_closure_rate: 0,
      good_first_issues_count: 0,
      releases_last_year: 0,
      days_since_last_commit: 0,
      file_count: 0,
      folder_depth: 0,
      has_dependency_file: false,
      language_count: 0,
      activity_score: null,
      complexity_score: null,
      confidence_score: null,
      onboarding_health_score: null,
      model_version: "model-b-v2",
      explainability: {
        rationale: "Unable to compute explanation due to upstream fetch failure",
        top_positive_drivers: [],
        top_friction_drivers: [item.error.error]
      },
      difficulty: "Unknown",
      notes: [item.error.error],
      data_quality: item.error.dataQuality,
      error: item.error.error
    };
  });

  const response: AnalyzeResponse = {
    analyzed_at: new Date().toISOString(),
    total: results.length,
    results
  };

  res.status(200).json(response);
}
