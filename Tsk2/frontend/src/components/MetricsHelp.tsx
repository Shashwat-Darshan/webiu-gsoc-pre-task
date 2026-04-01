export function MetricsHelp() {
  return (
    <section className="metrics-help-panel" style={{ display: "grid", gap: "1.5rem" }}>
      <div>
        <h3 style={{ marginBottom: "0.75rem" }}>Advanced Scoring Mathematics</h3>
        <p style={{ fontSize: "0.9rem", color: "var(--muted)", margin: "0 0 1rem 0" }}>
          The production model uses power-law normalization with weighted composites for scale, friction,
          welcomingness, and activity momentum.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "1rem" }}>
          <div style={{ padding: "1rem", background: "#f8f6ef", borderRadius: "8px", fontFamily: "monospace", color: "var(--ink)", fontSize: "0.85rem", overflowX: "auto" }}>
            <strong>Scale (S)</strong><br />
            S = 0.20 * norm(stars, 10000)<br />
            &nbsp;&nbsp;+ 0.35 * norm(contributors, 1000)<br />
            &nbsp;&nbsp;+ 0.45 * norm(commits90d, 1000)
          </div>

          <div style={{ padding: "1rem", background: "#f8f6ef", borderRadius: "8px", fontFamily: "monospace", color: "var(--ink)", fontSize: "0.85rem", overflowX: "auto" }}>
            <strong>Friction (F)</strong><br />
            F = 0.60 * norm(fileCount, 5000)<br />
            &nbsp;&nbsp;+ 0.20 * norm(folderDepth, 12)<br />
            &nbsp;&nbsp;+ 0.20 * staleness
          </div>

          <div style={{ padding: "1rem", background: "#f8f6ef", borderRadius: "8px", fontFamily: "monospace", color: "var(--ink)", fontSize: "0.85rem", overflowX: "auto" }}>
            <strong>Welcomingness (W)</strong><br />
            W = 0.50 * (health / 100)<br />
            &nbsp;&nbsp;+ 0.30 * norm(goodFirstIssues, 50)<br />
            &nbsp;&nbsp;+ 0.20 * issueClosureRate
          </div>

          <div style={{ padding: "1rem", background: "#f8f6ef", borderRadius: "8px", fontFamily: "monospace", color: "var(--ink)", fontSize: "0.85rem", overflowX: "auto" }}>
            <strong>Activity momentum (A)</strong><br />
            A = 0.35 * norm(commits90d, 500)<br />
            &nbsp;&nbsp;+ 0.20 * norm(closedIssues90d, 200)<br />
            &nbsp;&nbsp;+ 0.15 * norm(releases1y, 24)<br />
            &nbsp;&nbsp;+ 0.20 * (1 - staleness)<br />
            &nbsp;&nbsp;+ 0.10 * issueClosureRate
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>Raw Difficulty Optimization</h3>
        
        <div style={{ padding: "1rem", background: "#f8f6ef", borderRadius: "8px", fontFamily: "monospace", color: "var(--ink)", fontSize: "0.85rem", marginBottom: "0.75rem", overflowX: "auto" }}>
          D_core = 0.55 * F - 1.45 * W - 0.22 * S + 0.35 * (1 - A)<br />
          D_adj = D_core * EcosystemAdjustment + 0.40 * DataReliabilityPenalty<br />
          P_advanced = 1 / (1 + exp(-3.4 * (D_adj - 0.26)))
        </div>

        <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 1rem 0", lineHeight: 1.5 }}>
          Friction drives baseline complexity while welcomingness, scale, and activity momentum reduce effective
          newcomer risk. Ecosystem and data quality then adjust the final advanced probability.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div className="badge badge-beginner">Beginner &lt; 35%</div>
          <div className="badge badge-intermediate">Intermediate 35-70%</div>
          <div className="badge badge-advanced">Advanced &gt; 70%</div>
        </div>
      </div>
    </section>
  );
}
