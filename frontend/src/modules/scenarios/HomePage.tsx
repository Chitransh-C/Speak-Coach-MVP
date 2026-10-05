import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

type Track = {
  id: string;
  title: string;
  description: string;
  scenarioCount: number;
};

type ScenarioListItem = {
  id: string;
  title: string;
  description: string;
  trackId: string;
  trackTitle: string;
  level: string;
  estDurationMin: number;
  availability: string;
  participantName: string;
  participantRole: string | null;
  status: string;
  latestScore: { overall: number; passed: boolean } | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function HomePage() {
  const { token } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [items, setItems] = useState<ScenarioListItem[]>([]);
  const [trackFilter, setTrackFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ tracks: Track[] }>("/tracks", { token }),
      api<{ scenarios: ScenarioListItem[] }>("/scenarios", { token }),
    ])
      .then(([t, s]) => {
        setTracks(t.tracks);
        setItems(s.scenarios);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load catalog"),
      );
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((s) => {
      if (trackFilter !== "all" && s.trackId !== trackFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.trackTitle.toLowerCase().includes(q)
      );
    });
  }, [items, trackFilter, query]);

  return (
    <div className="stack-md">
      <section className="hero-banner">
        <div className="hero-banner-inner">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              Catalog
            </div>
            <h1 className="page-title">Practice by track</h1>
            <p className="page-lede">
              Two tracks — Interviews and Sales — each with one Voice Agent. Scenarios inject
              client/interviewer details via variables. Pick a scenario, then Learn → Watch → Setup
              → Practice → Feedback.
            </p>
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="track-chips">
          <button
            type="button"
            className={`chip ${trackFilter === "all" ? "active" : ""}`}
            onClick={() => setTrackFilter("all")}
          >
            All
            <span className="chip-count">{items.length}</span>
          </button>
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip ${trackFilter === t.id ? "active" : ""}`}
              onClick={() => setTrackFilter(t.id)}
            >
              {t.title}
              <span className="chip-count">{t.scenarioCount}</span>
            </button>
          ))}
        </div>
        <input
          className="toolbar-input"
          style={{ minWidth: "12rem" }}
          placeholder="Filter scenarios…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="scenario-grid">
        {filtered.map((s) => {
          const comingSoon = s.availability !== "live";
          const partner = s.participantName || "Client";
          return (
            <article key={s.id} className={`scenario-card ${comingSoon ? "dimmed" : ""}`}>
              <div className="stack-sm">
                <div className="card-meta">
                  <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                    <span className="track-badge">{s.trackTitle}</span>
                    <span>· {s.level}</span>
                  </div>
                  <span>{s.estDurationMin} min</span>
                </div>
                <div>
                  <h2 style={{ fontSize: "1.2rem", marginBottom: "0.35rem" }}>{s.title}</h2>
                  <p className="muted" style={{ fontSize: "0.88rem" }}>
                    {s.description}
                  </p>
                </div>
                <div className="partner-inset">
                  <span className="partner-avatar">{initials(partner)}</span>
                  <div>
                    <div className="partner-name">{partner}</div>
                    <div className="partner-role">
                      {comingSoon
                        ? "Coming soon"
                        : s.participantRole || "Live interactive partner"}
                    </div>
                  </div>
                </div>
              </div>
              <div className="stack-sm">
                {s.latestScore ? (
                  <div className="score-chip">
                    Last score: <strong>{s.latestScore.overall}</strong>
                    {s.latestScore.passed ? " · Passed" : " · Retry"}
                  </div>
                ) : comingSoon ? (
                  <p className="badge coming">Coming soon</p>
                ) : (
                  <div className="score-chip">Live interactive</div>
                )}
                {comingSoon ? (
                  <button className="btn btn-ghost btn-block" type="button" disabled>
                    Not available yet
                  </button>
                ) : (
                  <Link className="btn btn-primary btn-block" to={`/scenarios/${s.id}/learn`}>
                    {s.status === "completed" ? "Practice again" : "Start scenario"}
                  </Link>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && !error && (
        <div className="empty-state">
          <h2>No scenarios match</h2>
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            Try another track or clear the filter.
          </p>
        </div>
      )}
    </div>
  );
}
