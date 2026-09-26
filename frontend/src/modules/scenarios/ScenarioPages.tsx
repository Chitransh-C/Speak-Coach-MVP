import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

type ScenarioDetail = {
  id: string;
  title: string;
  learn: {
    situation: string;
    participant: { name: string; role: string; tone: string; agenda: string };
    whatGoodLooksLike: string[];
    objectives: string[];
  };
  watch: { turns: { speaker: string; text: string }[] };
};

function StepNav({ active }: { active: "learn" | "watch" | "practice" | "feedback" }) {
  const order = ["learn", "watch", "practice", "feedback"] as const;
  const idx = order.indexOf(active);
  return (
    <div className="steps">
      {order.map((s, i) => (
        <span
          key={s}
          className={`step ${i === idx ? "active" : ""} ${i < idx ? "done" : ""}`}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function useScenario() {
  const { scenarioId = "scenario-001" } = useParams();
  const { token } = useAuth();
  const [data, setData] = useState<ScenarioDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<ScenarioDetail>(`/api/v1/scenarios/${scenarioId}`, { token })
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
  active: "learn" | "watch" | "practice" | "feedback";
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="stack-md">
      <Link to="/" className="muted">
        ← Home
      </Link>
      <h1>{title}</h1>
      <StepNav active={active} />
      {children}
    </div>
  );
}

export function LearnPage() {
  const { scenarioId, data, error } = useScenario();
  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <p className="muted">Loading brief…</p>;
  const { learn } = data;
  return (
    <Shell active="learn" title={data.title}>
      <section className="panel stack-md">
        <div>
          <h2>Situation</h2>
          <p className="muted" style={{ marginTop: "0.4rem" }}>
            {learn.situation}
          </p>
        </div>
        <div>
          <h2>Meet {learn.participant.name}</h2>
          <p className="muted" style={{ marginTop: "0.4rem" }}>
            {learn.participant.role} · {learn.participant.tone}
          </p>
          <p className="muted">{learn.participant.agenda}</p>
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
  return (
    <Shell active="watch" title={data.title}>
      <section className="panel">
        <p className="muted" style={{ marginBottom: "1rem" }}>
          Read a strong sample exchange before you go live.
        </p>
        <div className="dialogue">
          {data.watch.turns.map((t, i) => (
            <div
              key={`${t.speaker}-${i}`}
              className={`bubble ${t.speaker === "Alex" ? "alex" : "learner"}`}
            >
              <div className="who">{t.speaker}</div>
              <div>{t.text}</div>
            </div>
          ))}
        </div>
        <div className="actions">
          <Link className="btn btn-ghost" to={`/scenarios/${scenarioId}/learn`}>
            Back
          </Link>
          <Link className="btn btn-accent" to={`/scenarios/${scenarioId}/practice`}>
            I’m ready — Practice
          </Link>
        </div>
      </section>
    </Shell>
  );
}
