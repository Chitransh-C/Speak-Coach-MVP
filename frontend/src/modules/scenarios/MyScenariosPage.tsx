import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

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

export function MyScenariosPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<ScenarioListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    return api<{ scenarios: ScenarioListItem[] }>("/scenarios/mine", { token })
      .then((s) => {
        setItems(s.scenarios);
        setError(null);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load your scenarios"),
      );
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onDelete(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      await api(`/scenarios/mine/${id}`, { method: "DELETE", token });
      await reload();
    } catch (err) {
      setError(err instanceof HttpError ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="catalog">
      <header className="catalog-head">
        <div>
          <h1 className="catalog-title">My Scenarios</h1>
          <p className="catalog-lede">Private practice scenarios only you can see and run.</p>
        </div>
        <Link className="btn btn-primary" to="/scenarios/create">
          Create Scenario
        </Link>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!error && items.length === 0 && (
        <div className="panel stack-sm" style={{ maxWidth: 480 }}>
          <p className="muted">You haven’t created any personal scenarios yet.</p>
          <Link className="btn btn-primary" to="/scenarios/create">
            Create your first scenario
          </Link>
        </div>
      )}

      <div className="scenario-grid">
        {items.map((s) => (
          <article key={s.id} className="scenario-card">
            <div className={`scenario-visual scenario-visual--default`}>
              <span className="scenario-avatar" aria-hidden>
                {initials(s.participantName)}
              </span>
            </div>
            <div className="scenario-body">
              <div className="scenario-meta">
                <span>{s.trackTitle || "Personal"}</span>
                <span>·</span>
                <span>{s.level}</span>
                <span>·</span>
                <span>{s.estDurationMin} min</span>
                <span>·</span>
                <span>{s.availability === "live" ? "Live" : "Draft"}</span>
              </div>
              <h2 className="scenario-title">{s.title}</h2>
              <p className="scenario-desc">{s.description}</p>
              <p className="muted" style={{ fontSize: "0.85rem" }}>
                With {s.participantName}
                {s.participantRole ? ` · ${s.participantRole}` : ""}
              </p>
              <div className="actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
                <Link className="btn btn-primary" to={`/scenarios/${s.id}/learn`}>
                  Practice
                </Link>
                <Link className="btn btn-ghost" to={`/my-scenarios/${s.id}/edit`}>
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === s.id}
                  onClick={() => void onDelete(s.id, s.title)}
                >
                  {busyId === s.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
