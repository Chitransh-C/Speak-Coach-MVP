import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

type ScenarioListItem = {
  id: string;
  title: string;
  description: string;
  level: string;
  estDurationMin: number;
  status: string;
  latestScore: { overall: number; passed: boolean } | null;
};

export function HomePage() {
  const { token } = useAuth();
  const [items, setItems] = useState<ScenarioListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ scenarios: ScenarioListItem[] }>("/api/v1/scenarios", { token })
      .then((res) => setItems(res.scenarios))
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load scenarios"),
      );
  }, [token]);

  return (
    <div className="stack-md">
      <div>
        <p className="pill">Your path</p>
        <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", marginTop: "0.35rem" }}>
          One scenario. Real interview pressure.
        </h1>
        <p className="muted" style={{ marginTop: "0.5rem", maxWidth: "42ch" }}>
          Learn the brief, watch a model exchange, practice live with Alex Rivera, then get a
          scored coach report.
        </p>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="stack-md">
        {items.map((s) => (
          <article key={s.id} className="scenario-card">
            <div className="pill">{s.level} · {s.estDurationMin} min</div>
            <h2>{s.title}</h2>
            <p className="muted">{s.description}</p>
            {s.latestScore && (
              <p className="muted">
                Last score: <strong>{s.latestScore.overall}</strong>{" "}
                {s.latestScore.passed ? "(passed)" : "(retry recommended)"}
              </p>
            )}
            <div className="actions">
              <Link className="btn btn-primary" to={`/scenarios/${s.id}/learn`}>
                {s.status === "completed" ? "Practice again" : "Start scenario"}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
