import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";

type ScenarioSetup = {
  id: string;
  title: string;
  availability: string;
  canPractice: boolean;
  languages: { code: string; label: string; sarvamName: string }[];
  defaults: { language: string; voice: string };
  learn: { participant: { name: string } };
};

const SETUP_KEY = (id: string) => `speakcoach_setup_${id}`;

export function saveSetup(scenarioId: string, language: string, voice?: string) {
  sessionStorage.setItem(
    SETUP_KEY(scenarioId),
    JSON.stringify({ language, voice: voice || undefined }),
  );
}

export function loadSetup(scenarioId: string): { language: string; voice?: string } | null {
  try {
    const raw = sessionStorage.getItem(SETUP_KEY(scenarioId));
    return raw ? (JSON.parse(raw) as { language: string; voice?: string }) : null;
  } catch {
    return null;
  }
}

export function SetupPage() {
  const { scenarioId = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ScenarioSetup | null>(null);
  const [language, setLanguage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ScenarioSetup>(`/scenarios/${scenarioId}`, { token })
      .then((res) => {
        setData(res);
        const saved = loadSetup(scenarioId);
        const langOk =
          saved?.language && res.languages.some((l) => l.code === saved.language)
            ? saved.language
            : res.defaults.language;
        setLanguage(langOk);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load setup"),
      );
  }, [scenarioId, token]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data?.canPractice) {
      setError("This scenario is not available for live practice yet.");
      return;
    }
    // Voice is server-defaulted by character gender; not shown in UI yet.
    saveSetup(scenarioId, language, data.defaults.voice);
    navigate(`/scenarios/${scenarioId}/practice`);
  }

  if (error && !data) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="muted">Loading setup…</p>;

  return (
    <div className="stack-md">
      <Link to={`/scenarios/${scenarioId}/watch`} className="muted">
        ← Watch
      </Link>
      <h1 className="page-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
        {data.title}
      </h1>
      <JourneyStepper active="setup" />

      <form className="panel stack-md" onSubmit={onSubmit}>
        <div>
          <h2>Practice setup</h2>
          <p className="muted" style={{ marginTop: "0.35rem" }}>
            You’ll practice with {data.learn.participant.name}. Choose the language for this call.
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {!data.canPractice && (
          <div className="error-banner">
            This scenario is coming soon — live practice is not enabled yet.
          </div>
        )}

        <fieldset className="choice-fieldset" disabled={!data.canPractice}>
          <legend>Language</legend>
          <div className="choice-grid" role="listbox" aria-label="Language">
            {data.languages.map((l) => (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={language === l.code}
                className={`choice-card ${language === l.code ? "active" : ""}`}
                onClick={() => setLanguage(l.code)}
              >
                <span className="choice-card-title">{l.label}</span>
                <span className="choice-card-meta">{l.code}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="actions">
          <Link className="btn btn-ghost" to={`/scenarios/${scenarioId}/watch`}>
            Back
          </Link>
          <button className="btn btn-accent" type="submit" disabled={!data.canPractice || !language}>
            Start practice
          </button>
        </div>
      </form>
    </div>
  );
}
