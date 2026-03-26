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

export function ScoreBar({ label, score }: ScoreBarProps) {
  const value = score ?? 0;

  return (
    <div className="score-row">
      <div className="score-row-label">
        <span>{label}</span>
        <strong>{score ?? "N/A"}</strong>
      </div>
      <div className="score-track" role="progressbar" aria-label={`${label} score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <div className={classForScore(value)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
