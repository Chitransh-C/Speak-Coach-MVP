import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";

type ScenarioDetail = {
  id: string;
  title: string;
  availability: string;
  canPractice: boolean;
  learn: {
    situation: string;
    participant: { name: string; role: string; tone: string; agenda: string };
    whatGoodLooksLike: string[];
    objectives: string[];
  };
  watch: { turns: { speaker: string; text: string }[] };
};

function useScenario() {
  const { scenarioId = "" } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<ScenarioDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioId) {
      setError("Missing scenario");
      return;
    }
    api<ScenarioDetail>(`/scenarios/${scenarioId}`, { token })
      .then(setData)
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load scenario"),
      );
  }, [scenarioId, token]);

  return { scenarioId, data, error };
}

function Shell({
  active,
  title,
  children,
}: {
  active: "learn" | "watch" | "setup" | "practice" | "feedback";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="stack-md">
      <Link to="/" className="muted">
        ← Practice catalog
      </Link>
      <h1 className="page-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
        {title}
      </h1>
      <JourneyStepper active={active} />
      {children}
    </div>
  );
}

function isAgentSpeaker(speaker: string, participantName: string) {
  if (/learner|user/i.test(speaker)) return false;
  if (speaker === participantName) return true;
  return !/learner/i.test(speaker);
}

export function LearnPage() {
  const { scenarioId, data, error } = useScenario();
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="muted">Loading brief…</p>;
  const { learn } = data;
  return (
    <Shell active="learn" title={data.title}>
      <section className="panel stack-md">
        <div className="eyebrow">
          <span className="eyebrow-dot" />
          Scenario brief
        </div>
        <div>
          <h2>Situation</h2>
          <p className="muted" style={{ marginTop: "0.4rem" }}>
            {learn.situation}
          </p>
        </div>
        <div className="partner-inset">
          <span className="partner-avatar">
            {learn.participant.name
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </span>
          <div>
            <div className="partner-name">{learn.participant.name}</div>
            <div className="partner-role">
              {learn.participant.role} · {learn.participant.tone}
            </div>
            <p className="muted" style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
              {learn.participant.agenda}
            </p>
          </div>
        </div>
        <div>
          <h2>What good looks like</h2>
          <ul className="list-check" style={{ marginTop: "0.5rem" }}>
            {learn.whatGoodLooksLike.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Your objectives</h2>
          <ul className="list-check" style={{ marginTop: "0.5rem" }}>
            {learn.objectives.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="actions">
          <Link className="btn btn-primary" to={`/scenarios/${scenarioId}/watch`}>
            Continue to Watch
          </Link>
        </div>
      </section>
    </Shell>
  );
}

export function WatchPage() {
  const { scenarioId, data, error } = useScenario();
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="muted">Loading model dialogue…</p>;
  const participantName = data.learn.participant.name;
  return (
    <Shell active="watch" title={data.title}>
      <section className="panel">
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Read a strong sample exchange before you go live.
        </p>
        {data.watch.turns.length === 0 ? (
          <p className="muted">Sample dialogue coming soon.</p>
        ) : (
          <div className="dialogue">
            {data.watch.turns.map((t, i) => (
              <div
                key={`${t.speaker}-${i}`}
                className={`bubble ${isAgentSpeaker(t.speaker, participantName) ? "agent" : "learner"}`}
              >
                <div className="who">{t.speaker}</div>
                <div>{t.text}</div>
              </div>
            ))}
          </div>
        )}
        <div className="actions">
          <Link className="btn btn-ghost" to={`/scenarios/${scenarioId}/learn`}>
            Back
          </Link>
          <Link className="btn btn-accent" to={`/scenarios/${scenarioId}/setup`}>
            Continue to setup
          </Link>
        </div>
      </section>
    </Shell>
  );
}
