interface RepoInputFormProps {
  batchInput: string;
  totalCount: number;
  validCount: number;
  invalidRepos: string[];
  token: string;
  loading: boolean;
  progress: {
    done: number;
    total: number;
    currentRepo: string;
  };
  onBatchInputChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}

export function RepoInputForm({
  batchInput,
  totalCount,
  validCount,
  invalidRepos,
  token,
  loading,
  progress,
  onBatchInputChange,
  onTokenChange,
  onSubmit,
  onClear
}: RepoInputFormProps) {
  const hasValidationError = invalidRepos.length > 0;
  const progressPercent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="panel hero-panel">
      <div className="panel-head">
        <h2>Analyze repositories</h2>
        <p>Paste one or more GitHub URLs and generate intelligence reports instantly.</p>
      </div>

      <label className="field-label">GitHub token (optional)</label>
      <input
        className="text-input"
        type="password"
        aria-label="GitHub token"
        value={token}
        onChange={(event) => onTokenChange(event.target.value)}
        placeholder="ghp_..."
      />
      <p className="hint">Token increases rate limit budget from 60 to 5000 requests per hour.</p>

      <label className="field-label">Repository URLs (comma or newline separated)</label>
      <textarea
        className={`batch-textarea ${hasValidationError ? "input-error" : ""}`}
        aria-label="Repository URLs"
        value={batchInput}
        onChange={(event) => onBatchInputChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          // Force newline insertion even when host-level key handlers interfere.
          event.preventDefault();
          const target = event.currentTarget;
          const start = target.selectionStart ?? target.value.length;
          const end = target.selectionEnd ?? start;
          const nextValue = `${target.value.slice(0, start)}\n${target.value.slice(end)}`;
          onBatchInputChange(nextValue);

          requestAnimationFrame(() => {
            target.selectionStart = start + 1;
            target.selectionEnd = start + 1;
          });
        }}
        placeholder="https://github.com/owner/repo\nowner/repo\ngithub.com/owner/repo2"
        rows={10}
      />
      <p className="hint">
        Add as many lines as you want. More repos increase run time, but each repository's complexity
        score is computed independently.
      </p>
      <p className="hint">Accepted formats: `owner/repo`, `github.com/owner/repo`, or full GitHub URL.</p>
      <p className="hint">If some lines are invalid, valid lines will still be analyzed.</p>
      <p className="hint">
        💾 <strong>Smart caching enabled:</strong> Repeated analyses of the same repos within 5 minutes return instant cached results. Fetches fresh data after expiration.
      </p>

      <div className="validation-row">
        <p>{validCount} valid / {totalCount} total entries</p>
        {hasValidationError ? <p className="validation-error">Malformed URLs detected</p> : <p className="validation-ok">All URLs look valid</p>}
      </div>

      {hasValidationError ? (
        <details className="invalid-list">
          <summary>View invalid entries ({invalidRepos.length})</summary>
          <div className="invalid-list-body">
            {invalidRepos.slice(0, 6).map((repo) => (
              <p key={repo}>- {repo}</p>
            ))}
            {invalidRepos.length > 6 ? <p>... and {invalidRepos.length - 6} more</p> : null}
          </div>
        </details>
      ) : null}

      {loading ? (
        <div className="progress-wrap" aria-live="polite">
          <div className="progress-head">
            <strong>Analyzed {progress.done} of {progress.total} repositories</strong>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="progress-note">Fetching {progress.currentRepo || "repository..."}</p>
        </div>
      ) : null}

      <div className="form-footer">
        <p>Batch mode enabled for fast proposal demos</p>
        <div className="form-footer-actions">
          <button
            className="ghost-btn danger"
            onClick={onClear}
            type="button"
            disabled={loading || (!batchInput && totalCount === 0)}
          >
            Clear History
          </button>
          <button
            className="primary-btn"
            onClick={onSubmit}
            type="button"
            disabled={loading || validCount === 0}
          >
            {loading ? "Analyzing..." : "Analyze repositories"}
          </button>
        </div>
      </div>
    </section>
  );
}
