import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

type Track = { id: string; title: string; scenarioCount: number };

type ScenarioListItem = {
  id: string;
  title: string;
  trackId: string;
  trackTitle: string;
  level: string;
  availability: string;
  status: string;
  latestScore: { overall: number; passed: boolean } | null;
};

export function JourneyPage() {
  const { token } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [items, setItems] = useState<ScenarioListItem[]>([]);
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
        setError(err instanceof HttpError ? err.message : "Failed to load journey"),
      );
  }, [token]);

  const completed = items.filter((s) => s.status === "completed").length;
  const live = items.filter((s) => s.availability === "live");
  const next = live.find((s) => s.status !== "completed") ?? live[0];
  const progressPct = items.length ? Math.round((completed / items.length) * 100) : 0;

  const byTrack = useMemo(() => {
    return tracks.map((t) => {
      const scenarios = items.filter((s) => s.trackId === t.id);
      const done = scenarios.filter((s) => s.status === "completed").length;
      return { ...t, scenarios, done };
    });
  }, [tracks, items]);

  return (
    <div className="stack-md">
      <div>
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          Progress
        </div>
        <h1 className="page-title">My practice journey</h1>
        <p className="page-lede">
          Your real progress across Interviews and Sales — based on completed practice sessions.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <section className="panel stack-md">
        <h2 style={{ fontSize: "1.25rem" }}>Catalog progress</h2>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            <span>
              {completed} of {items.length} scenarios completed
            </span>
            <span className="muted">{progressPct}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </section>

      {next && (
        <section
          className="panel"
          style={{
            background:
              "linear-gradient(120deg, var(--surface-high), var(--surface-mid), var(--surface-low))",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: "0.4rem" }}>
                Next up
              </div>
              <h2 style={{ fontSize: "1.4rem" }}>{next.title}</h2>
              <p className="muted" style={{ marginTop: "0.35rem" }}>
                {next.trackTitle} · {next.level}
                {next.latestScore
                  ? ` · last score ${next.latestScore.overall}`
                  : " · not attempted"}
              </p>
            </div>
            <Link className="btn btn-primary" to={`/scenarios/${next.id}/learn`}>
              {next.status === "completed" ? "Practice again" : "Continue"}
            </Link>
          </div>
        </section>
      )}

      <div className="journey-map">
        {byTrack.map((t) => (
          <section key={t.id} className="panel stack-sm">
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1.25rem" }}>{t.title}</h2>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                {t.done}/{t.scenarios.length}
              </span>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${
                    t.scenarios.length ? Math.round((t.done / t.scenarios.length) * 100) : 0
                  }%`,
                }}
              />
            </div>
            <ul className="list-check">
              {t.scenarios.map((s) => (
                <li key={s.id}>
                  <Link to={`/scenarios/${s.id}/learn`}>
                    {s.title}
                    {s.status === "completed"
                      ? ` — done${s.latestScore ? ` (${s.latestScore.overall})` : ""}`
                      : s.availability === "live"
                        ? " — open"
                        : " — coming soon"}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
