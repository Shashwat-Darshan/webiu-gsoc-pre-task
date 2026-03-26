export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Unknown";
export type DataQuality =
  | "complete"
  | "partial"
  | "partial_search"
  | "partial_tree"
  | "degraded"
  | "unavailable";

export interface RepoExplainability {
  rationale: string;
  top_positive_drivers: string[];
  top_friction_drivers: string[];
}

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
  issue_closure_rate: number;
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
  model_version: string;
  explainability: RepoExplainability;
  difficulty: Difficulty;
  notes: string[];
  data_quality: DataQuality;
  error?: string;
}

export interface AnalysisResponse {
  analyzed_at: string;
  total: number;
  results: RepoAnalysis[];
}

export interface AnalyzeRequest {
  repos: string[];
  github_token?: string;
}
