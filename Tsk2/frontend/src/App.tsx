import { useMemo, useState } from "react";
import { analyzeRepos } from "./lib/api";
import type { RepoAnalysis } from "./types/analyzer";
import { RepoCard } from "./components/RepoCard";
import { RepoInputForm } from "./components/RepoInputForm";
import { RepoDetails } from "./components/RepoDetails";

const REPO_PATTERN = /^https?:\/\/github\.com\/[^\s/]+\/[^\s/]+\/?$/i;

interface ProgressState {
  done: number;
  total: number;
  currentRepo: string;
}

function parseRepositoryBatch(input: string): string[] {
  const normalized = input
    .replace(/\r\n/g, "\n")
    .replace(/[;,]+/g, "\n");

  const cleaned = normalized
    .split(/\n+/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);

  return [...new Set(cleaned)];
}

function normalizeRepositoryEntry(entry: string): string | null {
  let value = entry.trim();

  if (!value) {
    return null;
  }

  // Tolerate accidental spacing like "owner / repo" or "github.com / owner / repo".
  value = value.replace(/\s*\/\s*/g, "/").replace(/\s+/g, "");
  value = value.replace(/\.git$/i, "");

  if (/^[^\s/]+\/[^\s/]+$/.test(value)) {
    value = `https://github.com/${value}`;
  } else if (/^github\.com\//i.test(value)) {
    value = `https://${value}`;
  }

  if (!REPO_PATTERN.test(value)) {
    return null;
  }

  return value.replace(/^http:\/\//i, "https://").replace(/\/$/, "");
}

function buildErrorResult(repo: string, message: string): RepoAnalysis {
  return {
    repo,
    url: repo,
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
    model_version: "model-b-v1",
    explainability: {
      rationale: message,
      top_positive_drivers: [],
      top_friction_drivers: [message]
    },
    difficulty: "Unknown",
    notes: [message],
    data_quality: "unavailable",
    error: message
  };
}

function App() {
  const [batchInput, setBatchInput] = useState<string>(
    "https://github.com/nestjs/nest\nhttps://github.com/c2siorg/Webiu"
  );
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [analyzedAt, setAnalyzedAt] = useState<string>("");
  const [results, setResults] = useState<RepoAnalysis[]>([]);
  const [selected, setSelected] = useState<RepoAnalysis | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("activity");
  const [progress, setProgress] = useState<ProgressState>({ done: 0, total: 0, currentRepo: "" });

  const parsedRepos = useMemo(() => parseRepositoryBatch(batchInput), [batchInput]);
  const invalidRepos = useMemo(() => {
    return parsedRepos.filter((repo) => normalizeRepositoryEntry(repo) === null);
  }, [parsedRepos]);
  const validRepos = useMemo(() => {
    const normalizedRepos = parsedRepos
      .map((repo) => normalizeRepositoryEntry(repo))
      .filter((repo): repo is string => repo !== null);

    return [...new Set(normalizedRepos)];
  }, [parsedRepos]);

  const visibleResults = useMemo(() => {
    const filtered =
      difficultyFilter === "All"
        ? results
        : results.filter((item) => item.difficulty === difficultyFilter);

    return [...filtered].sort((a, b) => {
      if (sortBy === "activity") {
        return (b.activity_score ?? -1) - (a.activity_score ?? -1);
      }

      if (sortBy === "complexity") {
        return (b.complexity_score ?? -1) - (a.complexity_score ?? -1);
      }

      return b.stars - a.stars;
    });
  }, [results, difficultyFilter, sortBy]);

  const summary = useMemo(() => {
    const success = results.filter((item) => !item.error).length;
    return {
      total: results.length,
      success,
      failed: results.length - success
    };
  }, [results]);

  function handleClear(): void {
    setBatchInput("");
    setResults([]);
    setSelected(null);
    setAnalyzedAt("");
    setError("");
  }

  function handleSaveReport(): void {
    if (results.length === 0) {
      return;
    }

    const payload = {
      analyzed_at: analyzedAt || new Date().toISOString(),
      total: results.length,
      results
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = (analyzedAt || new Date().toISOString()).replace(/[:.]/g, "-");
    link.href = url;
    link.download = `analysis-report-${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleAnalyze(): Promise<void> {
    if (validRepos.length === 0) {
      return;
    }

    setError("");
    setLoading(true);
    setSelected(null);
    setResults([]);
    setProgress({ done: 0, total: validRepos.length, currentRepo: "" });

    try {
      const collected: RepoAnalysis[] = [];

      for (let index = 0; index < validRepos.length; index += 1) {
        const currentRepo = validRepos[index];
        setProgress({ done: index, total: validRepos.length, currentRepo });

        try {
          const payload = await analyzeRepos([currentRepo], token.trim() || undefined);
          const result = payload.results[0] ?? buildErrorResult(currentRepo, "No result returned by analyzer");
          collected.push(result);
          setAnalyzedAt(payload.analyzed_at);
        } catch (requestError) {
          const message = requestError instanceof Error ? requestError.message : "Unknown API error";
          collected.push(buildErrorResult(currentRepo, message));
        }

        setResults([...collected]);
        setProgress({ done: index + 1, total: validRepos.length, currentRepo });
      }

      setAnalyzedAt(new Date().toISOString());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unknown API error");
      setAnalyzedAt("");
    } finally {
      setProgress((previous) => ({ ...previous, currentRepo: "" }));
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="top-banner">
        <p className="kicker">GSoC Proof Dashboard</p>
        <h1>GitHub Repository Intelligence Analyzer</h1>
        <p>
          End-to-end UI for repository activity and complexity intelligence, built for proposal-grade
          demonstration.
        </p>
      </header>

      <RepoInputForm
        batchInput={batchInput}
        totalCount={parsedRepos.length}
        validCount={validRepos.length}
        invalidRepos={invalidRepos}
        token={token}
        loading={loading}
        progress={progress}
        onBatchInputChange={setBatchInput}
        onTokenChange={setToken}
        onSubmit={handleAnalyze}
        onClear={handleClear}
      />

      {error ? <p className="request-error">{error}</p> : null}

      <section className="panel results-panel">
        <div className="results-head">
          <div>
            <h2>Analysis results</h2>
            <p>
              {summary.total} analyzed | {summary.success} success | {summary.failed} failed
            </p>
            {analyzedAt ? <p className="timestamp">Generated at {new Date(analyzedAt).toUTCString()}</p> : null}
          </div>

          <div className="controls">
            <button className="ghost-btn" onClick={handleSaveReport} type="button" disabled={results.length === 0}>
              Save report
            </button>

            <label>
              Filter
              <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
                <option value="All">All</option>
                <option value="Beginner">Simple and Beginner-Friendly</option>
                <option value="Intermediate">Moderate Complexity and Guidance Needed</option>
                <option value="Advanced">Complex and Newcomer-Challenging</option>
                <option value="Unknown">Insufficient Data</option>
              </select>
            </label>

            <label>
              Sort
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="activity">Activity</option>
                <option value="complexity">Complexity</option>
                <option value="stars">Stars</option>
              </select>
            </label>
          </div>
        </div>

        <div className="content-grid">
          <div className="cards-grid">
            {visibleResults.length === 0 ? (
              <div className="empty-results">
                <h3>No data yet</h3>
                <p>Run an analysis to populate project insights.</p>
              </div>
            ) : (
              visibleResults.map((analysis) => (
                <RepoCard key={`${analysis.repo}-${analysis.url}`} analysis={analysis} onSelect={setSelected} />
              ))
            )}
          </div>

          <RepoDetails analysis={selected} onClose={() => setSelected(null)} />
        </div>
      </section>
    </div>
  );
}

export default App;
