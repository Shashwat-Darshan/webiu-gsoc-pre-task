export type DataQuality =
  | "complete"
  | "partial"
  | "partial_search"
  | "partial_tree"
  | "degraded"
  | "unavailable";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Unknown";

export interface AnalyzeRequest {
  repos: string[];
  github_token?: string;
}

export interface GitHubRepoRef {
  owner: string;
  name: string;
  fullName: string;
  url: string;
}

export interface RecentCommit {
  sha: string;
  message: string;
  author: string | null;
  date: string | null;
}

export interface RepositoryStats {
  stars: number;
  forks: number;
  openIssues: number;
  primaryLanguage: string | null;
  sizeKb: number;
  pushedAt: string | null;
  defaultBranch: string;
}

export interface RepositoryMetrics {
  contributorsCount: number;
  commitsLast90d: number;
  closedIssuesLast90d: number;
  issueClosureRate: number;
  releasesLastYear: number;
  daysSinceLastCommit: number;
  goodFirstIssuesCount: number;
  healthPercentage: number;
  fileCount: number;
  folderDepth: number;
  hasDependencyFile: boolean;
  languageCount: number;
}

export interface RepoExplainability {
  rationale: string;
  top_positive_drivers: string[];
  top_friction_drivers: string[];
}

export interface GitHubRepositoryData {
  repo: GitHubRepoRef;
  stats: RepositoryStats;
  metrics: RepositoryMetrics;
  languages: Record<string, number>;
  recentCommits: RecentCommit[];
  dataQuality: DataQuality;
}

export interface GitHubRepositoryError {
  repo: string;
  url: string;
  error: string;
  statusCode?: number;
  dataQuality: "unavailable";
  rateLimited?: boolean;
}

export type GitHubRepositoryResult =
  | {
      ok: true;
      data: GitHubRepositoryData;
    }
  | {
      ok: false;
      error: GitHubRepositoryError;
    };

export interface RepoAnalysis {
  repo: string;
  url: string;
  stars: number;
  forks: number;
  open_issues: number;
  primary_language: string | null;
  languages: Record<string, number>;
  contributors_count: number;
  commits_last_90d: number;
  closed_issues_last_90d: number;
  good_first_issues_count: number;
  releases_last_year: number;
  days_since_last_commit: number;
  file_count: number;
  folder_depth: number;
  has_dependency_file: boolean;
  language_count: number;
  activity_score: number | null;
  complexity_score: number | null;
  confidence_score: number | null;
  onboarding_health_score: number | null;
  issue_closure_rate: number;
  model_version: string;
  explainability: RepoExplainability;
  difficulty: Difficulty;
  notes: string[];
  data_quality: DataQuality;
  error?: string;
}

export interface AnalyzeResponse {
  analyzed_at: string;
  total: number;
  results: RepoAnalysis[];
}
