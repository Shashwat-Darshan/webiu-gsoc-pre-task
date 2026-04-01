import type { RepoAnalysis } from "../types/analyzer";
import { DifficultyBadge } from "./DifficultyBadge";
import { ScoreBar } from "./ScoreBar";
import { getOneGlanceSummary } from "../lib/interpretation";

interface RepoCardProps {
  analysis: RepoAnalysis;
  onSelect: (analysis: RepoAnalysis) => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function RepoCard({ analysis, onSelect }: RepoCardProps) {
  const languagePills = Object.entries(analysis.languages)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3);
  const quickSummary = getOneGlanceSummary(analysis);
  const confidence = analysis.confidence_score !== null ? `${(analysis.confidence_score * 100).toFixed(1)}%` : "N/A";

  return (
    <article className="repo-card">
      <header className="repo-card-head">
        <div className="repo-card-title-wrap">
          <h3>{analysis.repo}</h3>
          <p>{analysis.primary_language ?? "Unknown language"}</p>
        </div>
        <div className="card-badges">
          {analysis.error ? <span className="warn-chip">Fetch issue</span> : null}
          <DifficultyBadge difficulty={analysis.difficulty} />
        </div>
      </header>

      <div className="repo-mini-stats" aria-label="Repository quick stats">
        <span>Stars {formatNumber(analysis.stars)}</span>
        <span>Forks {formatNumber(analysis.forks)}</span>
        <span>Contributors {formatNumber(analysis.contributors_count)}</span>
      </div>

      <p className="quick-summary">{quickSummary}</p>

      <div className="metric-breakdown">
        <p>
          Activity: <strong>{analysis.activity_score ?? "N/A"}/100</strong> | Commits 90d {formatNumber(analysis.commits_last_90d)}
        </p>
        <p>
          Complexity: <strong>{analysis.complexity_score ?? "N/A"}/100</strong> | Files {formatNumber(analysis.file_count)}
        </p>
        <p>
          Advanced confidence: <strong>{confidence}</strong> | Data quality: <strong>{analysis.data_quality}</strong>
        </p>
      </div>

      <div className="pill-list">
        {languagePills.length === 0 ? <span className="tech-pill">No language data</span> : null}
        {languagePills.map(([language, percent]) => (
          <span className="tech-pill" key={language}>
            {language} {percent.toFixed(1)}%
          </span>
        ))}
      </div>

      <ScoreBar label="Activity" score={analysis.activity_score} />
      <ScoreBar label="Complexity" score={analysis.complexity_score} />

      {analysis.error ? <p className="error-text">{analysis.error}</p> : null}

      <button className="details-btn" onClick={() => onSelect(analysis)}>
        View full analysis
      </button>
    </article>
  );
}
