import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";

type ScenarioSetup = {
  id: string;
  title: string;
  availability: string;
  canPractice: boolean;
  participantGender?: "male" | "female";
  languages: { code: string; label: string }[];
  voices: { id: string; label: string; gender: string; tone?: string }[];
  defaults: { language: string; voice: string };
  learn: { participant: { name: string; gender?: string } };
};

const SETUP_KEY = (id: string) => `rolesmith_setup_${id}`;

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
  const [voice, setVoice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    api<ScenarioSetup>(`/scenarios/${scenarioId}`, { token })
      .then((res) => {
        setData(res);
        const saved = loadSetup(scenarioId);
        const langOk =
          saved?.language && res.languages.some((l) => l.code === saved.language)
            ? saved.language
            : res.defaults.language;
        const voiceOk =
          saved?.voice && res.voices.some((v) => v.id === saved.voice)
            ? saved.voice
            : res.defaults.voice;
        setLanguage(langOk);
        setVoice(voiceOk);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load setup"),
      );
  }, [scenarioId, token]);

  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    };
  }, []);

  function stopPreview() {
    try {
      audioRef.current?.pause();
    } catch {
      /* ignore */
    }
    audioRef.current = null;
    setPreviewingId(null);
  }

  async function previewVoice(e: MouseEvent, voiceId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!token || !data?.canPractice) return;
    stopPreview();
    setPreviewingId(voiceId);
    setError(null);
    try {
      const res = await api<{ audioBase64: string; mimeType: string }>("/gemini/voice-preview", {
        method: "POST",
        token,
        body: JSON.stringify({
          voiceId,
          languageCode: language || data.defaults.language,
        }),
      });
      const src = `data:${res.mimeType};base64,${res.audioBase64}`;
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => setPreviewingId(null);
      audio.onerror = () => {
        setPreviewingId(null);
        setError("Could not play voice preview");
      };
      await audio.play();
    } catch (err) {
      setPreviewingId(null);
      setError(err instanceof HttpError ? err.message : "Voice preview failed");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!data?.canPractice) {
      setError("This scenario is not available for live practice yet.");
      return;
    }
    stopPreview();
    saveSetup(scenarioId, language, voice);
    navigate(`/scenarios/${scenarioId}/practice`);
  }

  if (error && !data) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="muted">Loading setup…</p>;

  const gender =
    data.participantGender ||
    (data.learn.participant.gender === "female" ? "female" : "male");
  const genderLabel = gender === "female" ? "female" : "male";

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
            You’ll practice with {data.learn.participant.name}. Choose language and voice for
            Gemini Live.
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
          <div className="choice-grid choice-grid--languages" role="listbox" aria-label="Language">
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

        <fieldset className="choice-fieldset" disabled={!data.canPractice}>
          <legend>Voice</legend>
          <p className="muted setup-voice-note">
            This scenario is written with a {genderLabel} character, so only {genderLabel} voices
            are offered.
          </p>
          <p className="setup-voice-count">
            {genderLabel.toUpperCase()} ({data.voices.length})
          </p>
          <div className="choice-grid choice-grid--voices" role="listbox" aria-label="Voice">
            {data.voices.map((v) => (
              <button
                key={v.id}
                type="button"
                role="option"
                aria-selected={voice === v.id}
                className={`choice-card choice-card--voice ${voice === v.id ? "active" : ""}`}
                onClick={() => setVoice(v.id)}
              >
                <span className="choice-card-voice-row">
                  <span className="choice-card-title">{v.label}</span>
                  <span
                    className={`voice-preview-btn ${previewingId === v.id ? "playing" : ""}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Preview ${v.label}`}
                    onClick={(ev) => void previewVoice(ev, v.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        void previewVoice(ev as unknown as MouseEvent, v.id);
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path
                        d="M11 5L6 9H3v6h3l5 4V5z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M15.5 8.5a4.5 4.5 0 010 7M18.5 6a8 8 0 010 12"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </span>
                <span className="choice-card-meta">{v.tone ?? v.id}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="actions">
          <Link className="btn btn-ghost" to={`/scenarios/${scenarioId}/watch`}>
            Back
          </Link>
          <button
            className="btn btn-accent"
            type="submit"
            disabled={!data.canPractice || !language || !voice}
          >
            Start practice
          </button>
        </div>
      </form>
    </div>
  );
}
