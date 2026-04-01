import type { RepoAnalysis } from "../types/analyzer";
import { DifficultyBadge } from "./DifficultyBadge";
import { ScoreBar } from "./ScoreBar";
import { getOneGlanceSummary } from "../lib/interpretation";

interface RepoDetailsProps {
  analysis: RepoAnalysis | null;
  onClose: () => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function RepoDetails({ analysis, onClose }: RepoDetailsProps) {
  if (!analysis) {
    return (
      <section className="panel detail-panel empty-detail">
        <h3>Select a repository card</h3>
        <p>Detailed stats, notes, and language distribution will appear here.</p>
      </section>
    );
  }

  const languages = Object.entries(analysis.languages).sort(([, left], [, right]) => right - left);
  const quickSummary = getOneGlanceSummary(analysis);

  return (
    <section className="panel detail-panel">
      <div className="detail-head">
        <div>
          <h3>{analysis.repo}</h3>
          <a href={analysis.url} target="_blank" rel="noreferrer">
            {analysis.url}
          </a>
        </div>
        <div className="detail-actions">
          <DifficultyBadge difficulty={analysis.difficulty} />
          <button className="ghost-btn" onClick={onClose}>
            Clear
          </button>
        </div>
      </div>

      <div className="score-grid">
        <ScoreBar label="Activity score" score={analysis.activity_score} />
        <ScoreBar label="Complexity score" score={analysis.complexity_score} />
      </div>

      <div className="notes-block summary-block">
        <h4>One-glance summary</h4>
        <p>{quickSummary}</p>
      </div>

      <div className="section-block">
        <h4>Repository facts</h4>
        <div className="stat-grid">
        <div>Stars <strong>{formatNumber(analysis.stars)}</strong></div>
        <div>Forks <strong>{formatNumber(analysis.forks)}</strong></div>
        <div>Open issues <strong>{formatNumber(analysis.open_issues)}</strong></div>
        <div>Contributors <strong>{formatNumber(analysis.contributors_count)}</strong></div>
        <div>Commits 90d <strong>{formatNumber(analysis.commits_last_90d)}</strong></div>
        <div>Closed issues 90d <strong>{formatNumber(analysis.closed_issues_last_90d)}</strong></div>
        <div>Issue closure rate <strong>{(analysis.issue_closure_rate * 100).toFixed(1)}%</strong></div>
        <div>Good First Issues <strong>{formatNumber(analysis.good_first_issues_count ?? 0)}</strong></div>
        <div>Onboarding health <strong>{analysis.onboarding_health_score ?? "N/A"}</strong></div>
        <div>Advanced confidence <strong>{analysis.confidence_score !== null ? `${(analysis.confidence_score * 100).toFixed(1)}%` : "N/A"}</strong></div>
        <div>Model version <strong>{analysis.model_version}</strong></div>
        <div>Releases 1y <strong>{formatNumber(analysis.releases_last_year)}</strong></div>
        <div>File count <strong>{formatNumber(analysis.file_count)}</strong></div>
        </div>
      </div>

      <div className="notes-block">
        <h4>Explainability</h4>
        <ul>
          <li>{analysis.explainability.rationale}</li>
          {analysis.explainability.top_positive_drivers.map((driver) => (
            <li key={`positive-${driver}`}>Positive: {driver}</li>
          ))}
          {analysis.explainability.top_friction_drivers.map((driver) => (
            <li key={`friction-${driver}`}>Friction: {driver}</li>
          ))}
        </ul>
      </div>

      <div className="lang-block">
        <h4>Language distribution</h4>
        {languages.length === 0 ? (
          <p>No language data available.</p>
        ) : (
          <ul className="lang-list">
            {languages.map(([language, percentage]) => (
              <li key={language}>
                <span>{language}</span>
                <div className="lang-track">
                  <div className="lang-fill" style={{ width: `${Math.max(2, percentage)}%` }} />
                </div>
                <strong>{percentage.toFixed(2)}%</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="notes-block">
        <h4>Analysis notes</h4>
        <ul>
          {analysis.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
