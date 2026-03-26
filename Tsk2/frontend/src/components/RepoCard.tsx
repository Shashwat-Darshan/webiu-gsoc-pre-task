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
  const languagePills = Object.entries(analysis.languages).slice(0, 4);
  const quickSummary = getOneGlanceSummary(analysis);

  return (
    <article className="repo-card">
      <header className="repo-card-head">
        <div>
          <h3>{analysis.repo}</h3>
          <p>{analysis.primary_language ?? "Unknown language"}</p>
        </div>
        <div className="card-badges">
          {analysis.error ? <span className="warn-chip">Warning</span> : null}
          <DifficultyBadge difficulty={analysis.difficulty} />
        </div>
      </header>

      <div className="repo-mini-stats">
        <span>Stars {formatNumber(analysis.stars)}</span>
        <span>Forks {formatNumber(analysis.forks)}</span>
      </div>

      <div className="metric-breakdown">
        <p className="quick-summary">{quickSummary}</p>
        <p>
          Activity Score: <strong>{analysis.activity_score ?? "N/A"}/100</strong> | {formatNumber(analysis.commits_last_90d)} commits | {formatNumber(analysis.contributors_count)} contributors
        </p>
        <p>
          Complexity Score: <strong>{analysis.complexity_score ?? "N/A"}/100</strong> | {formatNumber(analysis.file_count)} files | {analysis.language_count} languages
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
