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
  practiceCallMin?: number;
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

function trackVisualClass(trackId: string) {
  if (trackId.includes("sales")) return "scenario-visual--sales";
  if (trackId.includes("interview")) return "scenario-visual--interview";
  return "scenario-visual--default";
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
        s.trackTitle.toLowerCase().includes(q) ||
        s.participantName.toLowerCase().includes(q)
      );
    });
  }, [items, trackFilter, query]);

  return (
    <div className="catalog">
      <header className="catalog-head">
        <div>
          <h1 className="catalog-title">Scenarios</h1>
          <p className="catalog-lede">
            Pick the kind of conversation you want to get better at.
          </p>
        </div>
        <Link className="btn btn-ghost catalog-journey-btn" to="/journey">
          My Journey
        </Link>
      </header>

      <div className="catalog-search">
        <span className="catalog-search-icon" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
        </span>
        <input
          className="catalog-search-input"
          placeholder="Search all scenarios…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search scenarios"
        />
      </div>

      <div className="catalog-filters" role="tablist" aria-label="Tracks">
        <button
          type="button"
          role="tab"
          aria-selected={trackFilter === "all"}
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
            role="tab"
            aria-selected={trackFilter === t.id}
            className={`chip ${trackFilter === t.id ? "active" : ""}`}
            onClick={() => setTrackFilter(t.id)}
          >
            {t.title}
            <span className="chip-count">{t.scenarioCount}</span>
          </button>
        ))}
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="scenario-grid">
        {filtered.map((s) => {
          const comingSoon = s.availability !== "live";
          const partner = s.participantName || "Client";
          return (
            <article key={s.id} className={`scenario-card ${comingSoon ? "dimmed" : ""}`}>
              <div className={`scenario-visual ${trackVisualClass(s.trackId)}`} aria-hidden>
                <span className="scenario-visual-label">{s.trackTitle}</span>
              </div>
              <div className="scenario-card-body">
                <div className="card-meta">
                  <span className="level-pill">{s.level}</span>
                  <span>
                    {s.practiceCallMin
                      ? `${s.practiceCallMin} min call`
                      : `${s.estDurationMin} min`}
                  </span>
                </div>
                <h2 className="scenario-card-title">{s.title}</h2>
                <p className="scenario-card-desc">{s.description}</p>
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
              <div className="scenario-card-actions">
                {s.latestScore ? (
                  <div className="score-chip">
                    Last score: <strong>{s.latestScore.overall}</strong>
                    {s.latestScore.passed ? " · Passed" : " · Retry"}
                  </div>
                ) : comingSoon ? (
                  <p className="badge coming">Coming soon</p>
                ) : (
                  <div className="score-chip">Live · Gemini</div>
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
            Try another track or clear the search.
          </p>
        </div>
      )}
    </div>
  );
}
