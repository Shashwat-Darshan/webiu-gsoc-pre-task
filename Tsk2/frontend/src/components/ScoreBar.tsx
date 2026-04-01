interface ScoreBarProps {
  label: string;
  score: number | null;
}

function classForScore(score: number): string {
  if (score <= 33) {
    return "score-fill score-low";
  }

  if (score <= 66) {
    return "score-fill score-mid";
  }

  return "score-fill score-high";
}

function scoreState(score: number): string {
  if (score <= 33) {
    return "Low";
  }

  if (score <= 66) {
    return "Moderate";
  }

  return "High";
}

export function ScoreBar({ label, score }: ScoreBarProps) {
  const value = score ?? 0;
  const state = score === null ? "N/A" : scoreState(value);

  return (
    <div className="score-row">
      <div className="score-row-label">
        <span>{label}</span>
        <strong>{score ?? "N/A"} <span className="score-state">{state}</span></strong>
      </div>
      <div className="score-track" role="progressbar" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={classForScore(value)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
