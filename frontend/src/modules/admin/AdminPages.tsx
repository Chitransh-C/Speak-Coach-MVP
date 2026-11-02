import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { ScenarioEditorForm, learnToForm } from "@/modules/scenarios/ScenarioEditorForm";

function useAdminGet<T>(path: string, deps: unknown[] = []) {
  const { token } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api<T>(path, { token })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof HttpError ? err.message : "Request failed");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, path, ...deps]);

  return { data, error, loading, setData, reloadPath: path };
}

export function AdminDashboardPage() {
  const { data, error, loading } = useAdminGet<{
    kpis: Record<string, number | null>;
    topScenarios: { scenarioId: string; title: string; count: number }[];
    recentFailed: {
      sessionId: string;
      overall: number;
      scenarioTitle: string;
      userEmail: string;
      createdAt: string;
    }[];
    sessionsOverTime: { date: string; count: number }[];
    system: Record<string, string | boolean>;
  }>("/admin/stats");

  if (loading) return <p className="muted">Loading dashboard…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  const k = data.kpis;
  return (
    <div className="stack-md">
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Dashboard
      </h1>
      <div className="admin-kpi-grid">
        {[
          ["Users", k.usersTotal],
          ["New users (7d)", k.usersNew7d],
          ["Sessions (7d)", k.sessions7d],
          ["Completed (7d)", k.completed7d],
          ["Pass rate (7d)", k.passRate7d != null ? `${k.passRate7d}%` : "—"],
          ["Avg score (7d)", k.avgScore7d ?? "—"],
        ].map(([label, value]) => (
          <div key={String(label)} className="admin-kpi">
            <div className="admin-kpi-label">{label}</div>
            <div className="admin-kpi-value">{value}</div>
          </div>
        ))}
      </div>

      <div className="admin-panels">
        <section className="panel stack-sm">
          <h2>Top scenarios (30d)</h2>
          {data.topScenarios.length === 0 ? (
            <p className="muted">No sessions yet.</p>
          ) : (
            <ul className="admin-list">
              {data.topScenarios.map((s) => (
                <li key={s.scenarioId}>
                  <span>{s.title}</span>
                  <strong>{s.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="panel stack-sm">
          <h2>Recent failed scores</h2>
          {data.recentFailed.length === 0 ? (
            <p className="muted">None.</p>
          ) : (
            <ul className="admin-list">
              {data.recentFailed.map((s) => (
                <li key={s.sessionId}>
                  <Link to={`/admin/sessions/${s.sessionId}`}>
                    {s.scenarioTitle} · {s.userEmail}
                  </Link>
                  <strong>{s.overall}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel stack-sm">
        <h2>System</h2>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          Voice: {String(data.system.voiceProvider)} · {String(data.system.voiceModel)} · Chat:{" "}
          {String(data.system.chatProvider)} · {String(data.system.chatModel)} · Gemini key:{" "}
          {data.system.geminiKeyConfigured ? "configured" : "missing"}
        </p>
        {data.sessionsOverTime.length > 0 && (
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Sessions/day (30d):{" "}
            {data.sessionsOverTime
              .slice(-7)
              .map((d) => `${d.date.slice(5)}:${d.count}`)
              .join(" · ")}
          </p>
        )}
      </section>
    </div>
  );
}

export function AdminUsersPage() {
  const { token } = useAuth();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    const s = params.toString();
    return `/admin/users${s ? `?${s}` : ""}`;
  }, [q, role]);
  const { data, error, loading } = useAdminGet<{
    users: {
      id: string;
      email: string;
      displayName: string;
      role: string;
      disabled: boolean;
      sessionCount: number;
      createdAt: string;
    }[];
  }>(path, [path]);

  async function patch(id: string, body: Record<string, unknown>) {
    await api(`/admin/users/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    });
    window.location.reload();
  }

  return (
    <div className="stack-md">
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Users
      </h1>
      <div className="admin-toolbar">
        <input
          className="toolbar-input"
          placeholder="Search email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="toolbar-select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">All roles</option>
          <option value="learner">Learner</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Sessions</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/admin/users/${u.id}`}>{u.displayName}</Link>
                  </td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.sessionCount}</td>
                  <td>{u.disabled ? "Disabled" : "Active"}</td>
                  <td className="admin-row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                      onClick={() =>
                        void patch(u.id, {
                          role: u.role === "admin" ? "learner" : "admin",
                        })
                      }
                    >
                      Make {u.role === "admin" ? "learner" : "admin"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                      onClick={() => void patch(u.id, { disabled: !u.disabled })}
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminUserDetailPage() {
  const { id = "" } = useParams();
  const { data, error, loading } = useAdminGet<{
    id: string;
    email: string;
    displayName: string;
    role: string;
    disabled: boolean;
    sessions: {
      id: string;
      scenarioTitle: string;
      status: string;
      score: { overall: number; passed: boolean } | null;
    }[];
  }>(`/admin/users/${id}`);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  return (
    <div className="stack-md">
      <Link to="/admin/users" className="muted">
        ← Users
      </Link>
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        {data.displayName}
      </h1>
      <p className="muted">
        {data.email} · {data.role}
        {data.disabled ? " · disabled" : ""}
      </p>
      <section className="panel stack-sm">
        <h2>Recent sessions</h2>
        <ul className="admin-list">
          {data.sessions.map((s) => (
            <li key={s.id}>
              <Link to={`/admin/sessions/${s.id}`}>
                {s.scenarioTitle} · {s.status}
              </Link>
              <strong>{s.score ? s.score.overall : "—"}</strong>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminTracksPage() {
  const { token } = useAuth();
  const { data, error, loading } = useAdminGet<{
    tracks: {
      id: string;
      title: string;
      description: string;
      sortOrder: number;
      scenarioCount: number;
    }[];
  }>("/admin/tracks");
  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    sortOrder: 0,
  });
  const [msg, setMsg] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api("/admin/tracks", {
        method: "POST",
        token,
        body: JSON.stringify(form),
      });
      setMsg("Track created");
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof HttpError ? err.message : "Failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm(`Delete track ${id}?`)) return;
    try {
      await api(`/admin/tracks/${id}`, { method: "DELETE", token });
      window.location.reload();
    } catch (err) {
      alert(err instanceof HttpError ? err.message : "Delete failed");
    }
  }

  return (
    <div className="stack-md">
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Tracks
      </h1>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Scenarios</th>
                <th>Order</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.tracks.map((t) => (
                <tr key={t.id}>
                  <td>
                    <code>{t.id}</code>
                  </td>
                  <td>{t.title}</td>
                  <td>{t.scenarioCount}</td>
                  <td>{t.sortOrder}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: "0.35rem 0.7rem", fontSize: "0.8rem" }}
                      onClick={() => void onDelete(t.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <form className="panel stack-sm" onSubmit={(e) => void onCreate(e)}>
        <h2>Create track</h2>
        {msg && <p className="muted">{msg}</p>}
        <input
          className="toolbar-input"
          placeholder="id (e.g. coaching)"
          value={form.id}
          onChange={(e) => setForm({ ...form, id: e.target.value })}
          required
        />
        <input
          className="toolbar-input"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <textarea
          className="toolbar-input"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
        />
        <button className="btn btn-primary" type="submit">
          Create
        </button>
      </form>
    </div>
  );
}

export function AdminScenariosPage() {
  const { data, error, loading } = useAdminGet<{
    scenarios: {
      id: string;
      title: string;
      trackTitle: string;
      availability: string;
      practiceCallMin: number;
      level: string;
    }[];
  }>("/admin/scenarios");

  return (
    <div className="stack-md">
      <div className="catalog-head">
        <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
          Scenarios
        </h1>
        <Link className="btn btn-accent" to="/admin/scenarios/new">
          + Create catalog scenario
        </Link>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Track</th>
                <th>Level</th>
                <th>Call min</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.scenarios.map((s) => (
                <tr key={s.id}>
                  <td>{s.title}</td>
                  <td>{s.trackTitle}</td>
                  <td>{s.level}</td>
                  <td>{s.practiceCallMin}</td>
                  <td>{s.availability}</td>
                  <td>
                    <Link to={`/admin/scenarios/${s.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminScenarioEditPage() {
  const { id: routeId = "new" } = useParams();
  const isNew = !routeId || routeId === "new";
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data: tracksData } = useAdminGet<{ tracks: { id: string; title: string }[] }>(
    "/admin/tracks",
  );
  const { data: existing, error, loading } = useAdminGet<Record<string, unknown> | null>(
    isNew ? "" : `/admin/scenarios/${routeId}`,
    [routeId, isNew],
  );

  const initialForm = useMemo(() => {
    if (isNew || !existing || !("title" in existing)) return undefined;
    return {
      id: String(existing.id),
      trackId: String(existing.trackId),
      title: String(existing.title),
      description: String(existing.description),
      level: String(existing.level),
      estDurationMin: Number(existing.estDurationMin),
      practiceCallMin: Number(existing.practiceCallMin),
      points: Number(existing.points),
      passMark: Number(existing.passMark),
      availability: (existing.availability === "live" ? "live" : "coming_soon") as
        | "live"
        | "coming_soon",
      defaultLanguage: String(existing.defaultLanguage),
      defaultVoice: String(existing.defaultVoice),
      watchJson: JSON.stringify(existing.watch ?? { turns: [] }, null, 2),
    };
  }, [existing, isNew]);

  const initialLearn = useMemo(() => {
    if (isNew || !existing || !("learn" in existing)) return undefined;
    return learnToForm(existing.learn);
  }, [existing, isNew]);

  if (!isNew && loading) return <p className="muted">Loading…</p>;
  if (!isNew && error) return <div className="error-banner">{error}</div>;

  return (
    <div className="stack-md">
      <ScenarioEditorForm
        isNew={isNew}
        tracks={tracksData?.tracks ?? []}
        initialForm={initialForm}
        initialLearn={initialLearn}
        headerActions={
          <>
            <Link to="/admin/scenarios" className="muted">
              ← Catalog scenarios
            </Link>
            <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
              {isNew ? "Create catalog scenario" : "Edit catalog scenario"}
            </h1>
          </>
        }
        onSubmit={async ({ body }) => {
          if (isNew) {
            await api("/admin/scenarios", {
              method: "POST",
              token,
              body: JSON.stringify(body),
            });
          } else {
            const { id: _omit, ...patch } = body;
            await api(`/admin/scenarios/${routeId}`, {
              method: "PATCH",
              token,
              body: JSON.stringify(patch),
            });
          }
          navigate("/admin/scenarios");
        }}
        onTogglePublish={
          isNew
            ? undefined
            : async (next) => {
                await api(`/admin/scenarios/${routeId}`, {
                  method: "PATCH",
                  token,
                  body: JSON.stringify({ availability: next }),
                });
              }
        }
      />
    </div>
  );
}

export function AdminPromptsPage() {
  const { data, error, loading } = useAdminGet<{
    prompts: {
      id: string;
      kind: string;
      trackId: string | null;
      scenarioId: string | null;
      title: string;
    }[];
  }>("/admin/prompts");

  return (
    <div className="stack-md">
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Prompts
      </h1>
      <p className="muted" style={{ maxWidth: "60ch" }}>
        Scoring prompts live in the DB. Gemini Live persona instructions are also built in code
        (`gemini.system-prompt.ts`) from scenario variables.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Kind</th>
                <th>Track</th>
                <th>Scenario</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.prompts.map((p) => (
                <tr key={p.id}>
                  <td>{p.title || p.id}</td>
                  <td>
                    <code>{p.kind}</code>
                  </td>
                  <td>{p.trackId ?? "—"}</td>
                  <td>{p.scenarioId ?? "—"}</td>
                  <td>
                    <Link to={`/admin/prompts/${p.id}`}>Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminPromptEditPage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useAdminGet<{
    id: string;
    title: string;
    kind: string;
    body: string;
  }>(`/admin/prompts/${id}`);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title);
    setBody(data.body);
  }, [data]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/admin/prompts/${id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ title, body }),
      });
      navigate("/admin/prompts");
    } catch (err) {
      setMsg(err instanceof HttpError ? err.message : "Save failed");
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  return (
    <div className="stack-md">
      <Link to="/admin/prompts" className="muted">
        ← Prompts
      </Link>
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Edit prompt
      </h1>
      <p className="muted">
        <code>{data.kind}</code> · {data.id}
      </p>
      {msg && <div className="error-banner">{msg}</div>}
      <form className="panel stack-sm" onSubmit={(e) => void onSave(e)}>
        <input
          className="toolbar-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          className="toolbar-input admin-code"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={22}
          required
        />
        <button className="btn btn-primary" type="submit">
          Save
        </button>
      </form>
    </div>
  );
}

export function AdminSessionsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    const s = params.toString();
    return `/admin/sessions${s ? `?${s}` : ""}`;
  }, [q, status]);
  const { data, error, loading } = useAdminGet<{
    sessions: {
      id: string;
      status: string;
      language: string | null;
      durationMs: number | null;
      user: { email: string; displayName: string };
      scenario: { title: string };
      score: { overall: number; passed: boolean } | null;
      startedAt: string;
    }[];
  }>(path, [path]);

  return (
    <div className="stack-md">
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Sessions
      </h1>
      <div className="admin-toolbar">
        <input
          className="toolbar-input"
          placeholder="Search user or scenario…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="toolbar-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="created">created</option>
        </select>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {data && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>User</th>
                <th>Status</th>
                <th>Score</th>
                <th>Lang</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.scenario.title}</td>
                  <td>{s.user.email}</td>
                  <td>{s.status}</td>
                  <td>{s.score ? s.score.overall : "—"}</td>
                  <td>{s.language ?? "—"}</td>
                  <td>
                    <Link to={`/admin/sessions/${s.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminSessionDetailPage() {
  const { id = "" } = useParams();
  const { token } = useAuth();
  const { data, error, loading } = useAdminGet<{
    id: string;
    status: string;
    language: string | null;
    voice: string | null;
    durationMs: number | null;
    user: { email: string; displayName: string };
    scenario: { title: string; passMark: number };
    transcript: { turns: { speaker: string; text: string }[] } | null;
    score: {
      overall: number;
      passed: boolean;
      coachNotes: string;
      criteria: unknown;
    } | null;
    latencyEvents: { name: string; atMs: number }[];
  }>(`/admin/sessions/${id}`);
  const [msg, setMsg] = useState<string | null>(null);

  async function rescore() {
    setMsg(null);
    try {
      await api(`/admin/sessions/${id}/rescore`, { method: "POST", token });
      setMsg("Rescored");
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof HttpError ? err.message : "Rescore failed");
    }
  }

  function exportJson() {
    if (!data?.transcript) return;
    const blob = new Blob([JSON.stringify(data.transcript.turns, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-${id}-transcript.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  return (
    <div className="stack-md">
      <Link to="/admin/sessions" className="muted">
        ← Sessions
      </Link>
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        {data.scenario.title}
      </h1>
      <p className="muted">
        {data.user.displayName} ({data.user.email}) · {data.status} · {data.language}/{data.voice}
        {data.score ? ` · score ${data.score.overall}` : ""}
      </p>
      {msg && <p className="muted">{msg}</p>}
      <div className="actions">
        <button className="btn btn-accent" type="button" onClick={() => void rescore()}>
          Rescore
        </button>
        <button className="btn btn-ghost" type="button" onClick={exportJson}>
          Export transcript JSON
        </button>
      </div>
      {data.score && (
        <section className="panel stack-sm">
          <h2>Score</h2>
          <p>
            {data.score.overall} / pass {data.scenario.passMark} ·{" "}
            {data.score.passed ? "Passed" : "Failed"}
          </p>
          <p className="muted">{data.score.coachNotes}</p>
        </section>
      )}
      <section className="panel stack-sm">
        <h2>Transcript</h2>
        <div className="dialogue">
          {(data.transcript?.turns ?? []).map((t, i) => (
            <div key={`${t.speaker}-${i}`} className="bubble agent">
              <div className="who">{t.speaker}</div>
              <div>{t.text}</div>
            </div>
          ))}
        </div>
      </section>
      {data.latencyEvents.length > 0 && (
        <section className="panel stack-sm">
          <h2>Latency</h2>
          <ul className="admin-list">
            {data.latencyEvents.map((e, i) => (
              <li key={`${e.name}-${i}`}>
                <span>{e.name}</span>
                <strong>{e.atMs} ms</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function AdminHealthPage() {
  const { data, error, loading } = useAdminGet<{
    ok: boolean;
    dbOk: boolean;
    geminiKeyConfigured: boolean;
    chatProvider: string;
    voiceModel: string;
    chatModel: string;
    locales: { languages: number; voices: number };
  }>("/admin/health");

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return null;

  return (
    <div className="stack-md">
      <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
        Health
      </h1>
      <div className="admin-kpi-grid">
        <div className="admin-kpi">
          <div className="admin-kpi-label">Overall</div>
          <div className="admin-kpi-value">{data.ok ? "OK" : "Degraded"}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Database</div>
          <div className="admin-kpi-value">{data.dbOk ? "OK" : "Down"}</div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-label">Gemini key</div>
          <div className="admin-kpi-value">{data.geminiKeyConfigured ? "Yes" : "No"}</div>
        </div>
      </div>
      <section className="panel stack-sm">
        <p>
          Chat provider: <strong>{data.chatProvider}</strong> ({data.chatModel})
        </p>
        <p>
          Voice model: <strong>{data.voiceModel}</strong>
        </p>
        <p>
          Locale catalog: {data.locales.languages} languages · {data.locales.voices} voices
        </p>
      </section>
    </div>
  );
}
