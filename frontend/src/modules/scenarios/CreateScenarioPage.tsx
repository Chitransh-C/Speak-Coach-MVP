import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { learnToForm } from "@/modules/scenarios/scenarioFormShared";
import {
  PersonalScenarioForm,
  emptyPersonalScenarioForm,
} from "@/modules/scenarios/PersonalScenarioForm";

export function CreateScenarioPage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="stack-md">
      <PersonalScenarioForm
        isNew
        initialForm={emptyPersonalScenarioForm({ availability: "live" })}
        headerActions={
          <>
            <Link to="/my-scenarios" className="muted">
              ← My Scenarios
            </Link>
            <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
              Create personal scenario
            </h1>
            <p className="muted" style={{ maxWidth: "56ch" }}>
              Lives under the <strong>Personal</strong> track. Only you can see and practice it —
              separate from the shared Interviews / Sales catalog.
            </p>
          </>
        }
        onSubmit={async ({ body }) => {
          await api<{ id: string }>("/scenarios/mine", {
            method: "POST",
            token,
            body: JSON.stringify(body),
          });
          navigate("/my-scenarios");
        }}
      />
    </div>
  );
}

export function EditMyScenarioPage() {
  const { scenarioId = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!scenarioId) return;
    let cancelled = false;
    setLoading(true);
    api<Record<string, unknown>>(`/scenarios/mine/${scenarioId}`, { token })
      .then((data) => {
        if (!cancelled) {
          setExisting(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof HttpError ? err.message : "Failed to load scenario");
          setExisting(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, token]);

  const initialForm = useMemo(() => {
    if (!existing || !("title" in existing)) return undefined;
    return {
      title: String(existing.title),
      description: String(existing.description),
      level: String(existing.level),
      estDurationMin: Number(existing.estDurationMin),
      practiceCallMin: Number(existing.practiceCallMin),
      passMark: Number(existing.passMark),
      availability: (existing.availability === "live" ? "live" : "coming_soon") as
        | "live"
        | "coming_soon",
      defaultLanguage: String(
        (existing.defaults as { language?: string } | undefined)?.language ??
          existing.defaultLanguage ??
          "en-IN",
      ),
      defaultVoice: String(
        (existing.defaults as { voice?: string } | undefined)?.voice ??
          existing.defaultVoice ??
          "Charon",
      ),
      watchJson: JSON.stringify(existing.watch ?? { turns: [] }, null, 2),
    };
  }, [existing]);

  const initialLearn = useMemo(() => {
    if (!existing || !("learn" in existing)) return undefined;
    return learnToForm(existing.learn);
  }, [existing]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!initialForm) return null;

  return (
    <div className="stack-md">
      <PersonalScenarioForm
        isNew={false}
        initialForm={initialForm}
        initialLearn={initialLearn}
        headerActions={
          <>
            <Link to="/my-scenarios" className="muted">
              ← My Scenarios
            </Link>
            <h1 className="page-title" style={{ fontSize: "1.8rem" }}>
              Edit personal scenario
            </h1>
          </>
        }
        onSubmit={async ({ body }) => {
          const { trackId: _t, ...patch } = body;
          await api(`/scenarios/mine/${scenarioId}`, {
            method: "PATCH",
            token,
            body: JSON.stringify(patch),
          });
          navigate("/my-scenarios");
        }}
        onTogglePublish={async (next) => {
          await api(`/scenarios/mine/${scenarioId}`, {
            method: "PATCH",
            token,
            body: JSON.stringify({ availability: next }),
          });
        }}
      />
    </div>
  );
}
