import { DataQuality, Difficulty, GitHubRepositoryData, RepoAnalysis, RepoExplainability } from "../models/repo.model";

const MODEL_VERSION = "model-b-v2";
const MODEL_A_VERSION = "model-a-v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePowerLaw(value: number, maxExpected: number): number {
  if (value <= 0 || maxExpected <= 0) {
    return 0;
  }

  const ratio = Math.log10(value + 1) / Math.log10(maxExpected + 1);
  return clamp(ratio, 0, 1);
}

function sigmoid(x: number, k = 2.5, tau = 0.3): number {
  return 1 / (1 + Math.exp(-k * (x - tau)));
}

interface ModelScores {
  scaleScore: number;
  frictionScore: number;
  welcomingScore: number;
  activityMomentumScore: number;
  ecosystemAdjustment: number;
  dataReliabilityPenalty: number;
  activityScore: number;
  complexityScore: number;
}

interface ClassificationOutcome {
  difficulty: Difficulty;
  confidenceScore: number;
  modelVersion: string;
  notes: string[];
  explainability: RepoExplainability;
}

export interface IClassifierStrategy {
  classify(data: GitHubRepositoryData): ClassificationOutcome;
}

function computeScaleScore(data: GitHubRepositoryData): number {
  const stars = normalizePowerLaw(data.stats.stars, 10000);
  const contributors = normalizePowerLaw(data.metrics.contributorsCount, 1000);
  const commits = normalizePowerLaw(data.metrics.commitsLast90d, 1000);

  return clamp(stars * 0.2 + contributors * 0.35 + commits * 0.45, 0, 1);
}

function computeFrictionScore(data: GitHubRepositoryData): number {
  const files = normalizePowerLaw(data.metrics.fileCount, 5000);
  const depth = normalizePowerLaw(data.metrics.folderDepth, 12);
  const staleness = clamp(data.metrics.daysSinceLastCommit / 365, 0, 1);

  return clamp(files * 0.6 + depth * 0.2 + staleness * 0.2, 0, 1);
}

function computeWelcomingScore(data: GitHubRepositoryData): number {
  const health = clamp(data.metrics.healthPercentage / 100, 0, 1);
  const freshGfi = normalizePowerLaw(data.metrics.goodFirstIssuesCount, 50);
  const closureRate = clamp(data.metrics.issueClosureRate, 0, 1);

  return clamp(health * 0.5 + freshGfi * 0.3 + closureRate * 0.2, 0, 1);
}

function computeActivityScore(data: GitHubRepositoryData): number {
  return Math.round(computeActivityMomentumScore(data) * 100);
}

function computeActivityMomentumScore(data: GitHubRepositoryData): number {
  const commits = normalizePowerLaw(data.metrics.commitsLast90d, 500);
  const closedIssues = normalizePowerLaw(data.metrics.closedIssuesLast90d, 200);
  const releases = normalizePowerLaw(data.metrics.releasesLastYear, 24);
  const stalenessInverse = 1 - clamp(data.metrics.daysSinceLastCommit / 365, 0, 1);
  const closureRate = clamp(data.metrics.issueClosureRate, 0, 1);

  return clamp(
    commits * 0.35 +
      closedIssues * 0.2 +
      releases * 0.15 +
      stalenessInverse * 0.2 +
      closureRate * 0.1,
    0,
    1
  );
}

function computeEcosystemAdjustment(data: GitHubRepositoryData): number {
  const language = (data.stats.primaryLanguage ?? "").toLowerCase();

  const beginnerFriendly = new Set(["javascript", "typescript", "python", "go"]);
  const moderate = new Set(["java", "c#", "kotlin", "php", "ruby"]);
  const steeper = new Set(["c++", "rust", "swift", "scala"]);

  // Multipliers above 1 increase effective difficulty; below 1 reduce it.
  const base = beginnerFriendly.has(language) ? 0.95 : moderate.has(language) ? 1 : steeper.has(language) ? 1.08 : 1.02;
  const setupMultiplier = data.metrics.hasDependencyFile ? 1 : 1.05;
  const languageSpreadPenalty = clamp((data.metrics.languageCount - 8) / 20, 0, 0.08);

  return clamp(base * setupMultiplier - languageSpreadPenalty, 0.85, 1.15);
}

function shouldApplyMegaComplexityGuardrail(data: GitHubRepositoryData, scores: ModelScores): boolean {
  const explicitLargeTree = data.metrics.fileCount >= 10000;
  const likelyLargeFallbackTree = data.dataQuality === "partial_tree" && data.metrics.fileCount >= 5000;
  const highSystemFriction = scores.frictionScore >= 0.72;
  const strongScale = scores.scaleScore >= 0.65;

  return (explicitLargeTree || likelyLargeFallbackTree) && highSystemFriction && strongScale;
}

function computeDataReliabilityPenalty(dataQuality: DataQuality): number {
  switch (dataQuality) {
    case "complete":
      return 0;
    case "partial":
      return 0.03;
    case "partial_search":
      return 0.05;
    case "partial_tree":
      return 0.06;
    case "degraded":
      return 0.12;
    case "unavailable":
      return 0.2;
    default:
      return 0.06;
  }
}

function computeComplexityScore(data: GitHubRepositoryData): number {
  return Math.round(computeFrictionScore(data) * 100);
}

function computeModelScores(data: GitHubRepositoryData): ModelScores {
  const activityMomentumScore = computeActivityMomentumScore(data);

  return {
    scaleScore: computeScaleScore(data),
    frictionScore: computeFrictionScore(data),
    welcomingScore: computeWelcomingScore(data),
    activityMomentumScore,
    ecosystemAdjustment: computeEcosystemAdjustment(data),
    dataReliabilityPenalty: computeDataReliabilityPenalty(data.dataQuality),
    activityScore: Math.round(activityMomentumScore * 100),
    complexityScore: computeComplexityScore(data)
  };
}

function classifyDifficultyFromProbability(
  probabilityAdvanced: number,
  data: GitHubRepositoryData,
  scores: ModelScores
): Difficulty {
  if (probabilityAdvanced < 0.35) {
    if (shouldApplyMegaComplexityGuardrail(data, scores)) {
      return "Intermediate";
    }

    if (data.metrics.daysSinceLastCommit > 90) {
      return "Intermediate";
    }

    return "Beginner";
  }

  if (probabilityAdvanced > 0.7) {
    return "Advanced";
  }

  return "Intermediate";
}

function classifyDifficultyFromRules(scores: ModelScores, data: GitHubRepositoryData): Difficulty {
  const onboardingHealthScore = Math.round(scores.welcomingScore * 100);
  const maintenanceActivityScore = Math.round(
    clamp(
      normalizePowerLaw(data.metrics.commitsLast90d, 500) * 0.6 +
        clamp(data.metrics.issueClosureRate, 0, 1) * 0.25 +
        (1 - clamp(data.metrics.daysSinceLastCommit / 365, 0, 1)) * 0.15,
      0,
      1
    ) * 100
  );
  const effectiveComplexityScore = scores.complexityScore;

  if (onboardingHealthScore >= 75 && maintenanceActivityScore >= 40 && effectiveComplexityScore <= 85) {
    return "Beginner";
  }

  if (
    (effectiveComplexityScore >= 80 && onboardingHealthScore < 40) ||
    (maintenanceActivityScore < 20 && effectiveComplexityScore >= 50)
  ) {
    return "Advanced";
  }

  return "Intermediate";
}

function buildExplainability(
  data: GitHubRepositoryData,
  difficulty: Difficulty,
  pAdvanced: number,
  frictionScore: number,
  welcomingScore: number,
  activityMomentumScore: number,
  ecosystemAdjustment: number
): RepoExplainability {
  const topPositiveDrivers: string[] = [];
  const topFrictionDrivers: string[] = [];

  if (data.metrics.healthPercentage >= 75) {
    topPositiveDrivers.push("Strong community health profile and documentation coverage");
  }

  if (data.metrics.goodFirstIssuesCount >= 5) {
    topPositiveDrivers.push("Fresh, active 'good first issue' pipeline");
  }

  if (data.metrics.issueClosureRate >= 0.5) {
    topPositiveDrivers.push("Healthy issue closure ratio suggests active maintainer triage");
  }

  if (data.metrics.releasesLastYear >= 6) {
    topPositiveDrivers.push("Regular release cadence suggests a maintained and stable contribution path");
  }

  if (data.metrics.hasDependencyFile) {
    topPositiveDrivers.push("Dependency manifest is present, making setup reproducible for newcomers");
  }

  if (data.metrics.fileCount >= 2000) {
    topFrictionDrivers.push("Large effective code footprint increases navigation overhead");
  }

  if (data.metrics.folderDepth >= 8) {
    topFrictionDrivers.push("Deep directory depth raises newcomer search complexity");
  }

  if (data.metrics.daysSinceLastCommit > 90) {
    topFrictionDrivers.push("Staleness signal lowers onboarding confidence");
  }

  if (activityMomentumScore <= 0.35) {
    topFrictionDrivers.push("Low recent delivery momentum can slow feedback loops for first-time contributors");
  }

  if (!data.metrics.hasDependencyFile) {
    topFrictionDrivers.push("No standard dependency manifest detected, increasing setup ambiguity");
  }

  if (ecosystemAdjustment > 1.05) {
    topFrictionDrivers.push("Primary language ecosystem has a steeper onboarding curve");
  }

  if (data.dataQuality !== "complete") {
    topFrictionDrivers.push("Partial metrics were used due to API availability constraints");
  }

  const rationale =
    difficulty === "Beginner"
      ? `Low advanced-risk probability (${Math.round(pAdvanced * 100)}%) with welcomingness offsetting friction.`
      : difficulty === "Advanced"
        ? `High advanced-risk probability (${Math.round(pAdvanced * 100)}%) where friction dominates onboarding support.`
        : frictionScore > 0.9 && welcomingScore > 0.9
          ? "Large but well-scaffolded repository: strong onboarding keeps difficulty in the intermediate corridor."
          : `Balanced probability (${Math.round(pAdvanced * 100)}%) indicates moderate onboarding complexity.`;

  return {
    rationale,
    top_positive_drivers: topPositiveDrivers.slice(0, 3),
    top_friction_drivers: topFrictionDrivers.slice(0, 3)
  };
}

function buildNotes(
  data: GitHubRepositoryData,
  pAdvanced: number,
  difficulty: Difficulty,
  modelVersion: string,
  scores: ModelScores
): string[] {
  const notes: string[] = [];

  notes.push(`Model ${modelVersion} estimated ${Math.round(pAdvanced * 100)}% advanced difficulty probability`);

  if (data.metrics.healthPercentage >= 75) {
    notes.push(`Strong onboarding signal from community health score (${data.metrics.healthPercentage}%)`);
  }

  if (data.metrics.goodFirstIssuesCount > 0) {
    notes.push(`${data.metrics.goodFirstIssuesCount} fresh 'good first issue' labels detected in the last 90 days`);
  }

  if (data.metrics.daysSinceLastCommit > 90 && difficulty !== "Advanced") {
    notes.push("Beginner promotion was blocked by staleness guardrail (>90 days without recent push)");
  }

  if (shouldApplyMegaComplexityGuardrail(data, scores) && difficulty === "Intermediate") {
    notes.push("Beginner promotion was blocked by mega-complexity guardrail for large-scale repository surface area");
  }

  if (data.dataQuality !== "complete") {
    notes.push(`Data quality was ${data.dataQuality}; fallback-safe scoring was applied`);
  }

  return notes;
}

class ConfidenceWeightedStrategy implements IClassifierStrategy {
  private readonly alpha = 1.45;
  private readonly beta = 0.22;
  private readonly gamma = 0.35;
  private readonly delta = 0.4;
  private readonly k = 3.4;
  private readonly tau = 0.26;

  classify(data: GitHubRepositoryData): ClassificationOutcome {
    const scores = computeModelScores(data);
    const rawDifficulty =
      scores.frictionScore * 0.55 -
      scores.welcomingScore * this.alpha -
      scores.scaleScore * this.beta +
      (1 - scores.activityMomentumScore) * this.gamma;

    const adjustedDifficulty =
      rawDifficulty * scores.ecosystemAdjustment + scores.dataReliabilityPenalty * this.delta;

    const pAdvanced = sigmoid(adjustedDifficulty, this.k, this.tau);

    const difficulty = classifyDifficultyFromProbability(pAdvanced, data, scores);
    const explainability = buildExplainability(
      data,
      difficulty,
      pAdvanced,
      scores.frictionScore,
      scores.welcomingScore,
      scores.activityMomentumScore,
      scores.ecosystemAdjustment
    );

    return {
      difficulty,
      confidenceScore: Number(pAdvanced.toFixed(4)),
      modelVersion: MODEL_VERSION,
      notes: buildNotes(data, pAdvanced, difficulty, MODEL_VERSION, scores),
      explainability
    };
  }
}

class RulesBasedStrategy implements IClassifierStrategy {
  classify(data: GitHubRepositoryData): ClassificationOutcome {
    const scores = computeModelScores(data);
    const difficulty = classifyDifficultyFromRules(scores, data);
    const pAdvanced =
      difficulty === "Advanced" ? 0.8 : difficulty === "Intermediate" ? 0.5 : 0.2;

    const explainability = buildExplainability(
      data,
      difficulty,
      pAdvanced,
      scores.frictionScore,
      scores.welcomingScore,
      scores.activityMomentumScore,
      scores.ecosystemAdjustment
    );

    return {
      difficulty,
      confidenceScore: pAdvanced,
      modelVersion: MODEL_A_VERSION,
      notes: buildNotes(data, pAdvanced, difficulty, MODEL_A_VERSION, scores),
      explainability
    };
  }
}

class ScoringContext {
  constructor(private readonly strategy: IClassifierStrategy) {}

  evaluate(data: GitHubRepositoryData): ClassificationOutcome {
    return this.strategy.classify(data);
  }
}

function getDefaultScoringContext(): ScoringContext {
  // Model B is the default because it has smoother boundaries and fewer false-advanced outcomes.
  return new ScoringContext(new ConfidenceWeightedStrategy());
}

export function toRepoAnalysis(data: GitHubRepositoryData): RepoAnalysis {
  const context = getDefaultScoringContext();
  const classification = context.evaluate(data);
  const activityScore = computeActivityScore(data);
  const complexityScore = computeComplexityScore(data);

  return {
    repo: data.repo.fullName,
    url: data.repo.url,
    stars: data.stats.stars,
    forks: data.stats.forks,
    open_issues: data.stats.openIssues,
    primary_language: data.stats.primaryLanguage,
    languages: data.languages,
    contributors_count: data.metrics.contributorsCount,
    commits_last_90d: data.metrics.commitsLast90d,
    closed_issues_last_90d: data.metrics.closedIssuesLast90d,
    issue_closure_rate: data.metrics.issueClosureRate,
    good_first_issues_count: data.metrics.goodFirstIssuesCount,
    releases_last_year: data.metrics.releasesLastYear,
    days_since_last_commit: data.metrics.daysSinceLastCommit,
    file_count: data.metrics.fileCount,
    folder_depth: data.metrics.folderDepth,
    has_dependency_file: data.metrics.hasDependencyFile,
    language_count: data.metrics.languageCount,
    activity_score: activityScore,
    complexity_score: complexityScore,
    confidence_score: classification.confidenceScore,
    onboarding_health_score: data.metrics.healthPercentage,
    model_version: classification.modelVersion,
    explainability: classification.explainability,
    difficulty: classification.difficulty,
    notes: classification.notes,
    data_quality: data.dataQuality
  };
}
