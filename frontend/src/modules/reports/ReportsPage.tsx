import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

type SessionRow = {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  trackId: string;
  trackTitle: string;
  createdAt: string;
  endedAt: string | null;
  score: { overall: number; passed: boolean } | null;
};

type Summary = {
  total: number;
  avgScore: number | null;
  passRate: number | null;
  passed: number;
};

export function ReportsPage() {
  const { token } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trackFilter, setTrackFilter] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ sessions: SessionRow[]; summary: Summary }>("/sessions", { token })
      .then((res) => {
        setSessions(res.sessions);
        setSummary(res.summary);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load reports"),
      );
  }, [token]);

  const tracks = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => map.set(s.trackId, s.trackTitle));
    return [...map.entries()];
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter((s) => {
      if (trackFilter !== "all" && s.trackId !== trackFilter) return false;
      if (outcome === "passed" && !s.score?.passed) return false;
      if (outcome === "failed" && !(s.score && !s.score.passed)) return false;
      if (!q) return true;
      return (
        s.scenarioTitle.toLowerCase().includes(q) ||
        s.trackTitle.toLowerCase().includes(q)
      );
    });
  }, [sessions, trackFilter, outcome, query]);

  return (
    <div className="stack-md">
      <section className="hero-banner">
        <div className="hero-banner-inner">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Performance ledger
            </div>
            <h1 className="page-title">Reports &amp; analytics</h1>
            <p className="page-lede">
              Review scored sessions, pass rates, and trends across Interviews and Sales.
            </p>
          </div>
          <Link className="btn btn-primary" to="/">
            Practice more
          </Link>
        </div>
      </section>

      {summary && (
        <div className="metric-grid">
          <div className="metric-card">
            <div className="label">Total sessions</div>
            <div className="value">{summary.total}</div>
          </div>
          <div className="metric-card">
            <div className="label">Average score</div>
            <div className="value">{summary.avgScore ?? "—"}</div>
          </div>
          <div className="metric-card">
            <div className="label">Pass rate</div>
            <div className="value">
              {summary.passRate != null ? `${summary.passRate}%` : "—"}
            </div>
          </div>
          <div className="metric-card">
            <div className="label">Passed</div>
            <div className="value">{summary.passed}</div>
          </div>
        </div>
      )}

      <div className="toolbar">
        <input
          className="toolbar-input"
          style={{ flex: 1, minWidth: "12rem" }}
          placeholder="Search scenarios…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="toolbar-select"
          value={trackFilter}
          onChange={(e) => setTrackFilter(e.target.value)}
        >
          <option value="all">All tracks</option>
          {tracks.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select
          className="toolbar-select"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="all">All outcomes</option>
          <option value="passed">Passed (≥70)</option>
          <option value="failed">Needs retest</option>
        </select>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {!error && !filtered.length ? (
        <div className="empty-state">
          <h2>No sessions yet</h2>
          <p className="muted" style={{ marginTop: "0.5rem", marginBottom: "1.25rem" }}>
            Complete a practice call to unlock your first report.
          </p>
          <Link className="btn btn-primary" to="/">
            Browse catalog
          </Link>
        </div>
      ) : (
        <div className="report-list">
          {filtered.map((s) => (
            <div key={s.id} className="report-row">
              <div>
                <div style={{ fontWeight: 700 }}>{s.scenarioTitle}</div>
                <div className="muted" style={{ fontSize: "0.85rem" }}>
                  {s.trackTitle}
                </div>
              </div>
              <div className="muted" style={{ fontSize: "0.9rem" }}>
                {new Date(s.endedAt ?? s.createdAt).toLocaleString()}
              </div>
              <div>
                {s.score ? (
                  <strong>{s.score.overall}</strong>
                ) : (
                  <span className="muted">—</span>
                )}
              </div>
              <div>
                {s.score ? (
                  <span className={`badge ${s.score.passed ? "pass" : "fail"}`}>
                    {s.score.passed ? "Passed" : "Retry"}
                  </span>
                ) : (
                  <span className="muted">Unscored</span>
                )}
              </div>
              <Link className="btn btn-ghost" to={`/sessions/${s.id}/feedback`}>
                Open report
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
