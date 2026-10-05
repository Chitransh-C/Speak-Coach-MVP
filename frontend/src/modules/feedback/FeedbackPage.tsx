import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";

type Criterion = {
  id: string;
  name: string;
  weight: number;
  score: number;
  evidence?: { quote: string; note: string }[];
};

type Score = {
  overall: number;
  passed: boolean;
  criteria: Criterion[];
  strengths: string[];
  improvements: string[];
  coachNotes: string;
  metrics?: { talkListenRatio: number; questionsAsked: number; fillerWordCount: number };
};

export function FeedbackPage() {
  const { sessionId = "" } = useParams();
  const { token } = useAuth();
  const [score, setScore] = useState<Score | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ score: Score | null; scenarioId: string }>(`/sessions/${sessionId}`, {
      token,
    })
      .then((res) => {
        setScenarioId(res.scenarioId);
        if (!res.score) setError("Score not ready yet.");
        else setScore(res.score as Score);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load feedback"),
      );
  }, [sessionId, token]);

  if (error) {
    return (
      <div className="stack-md">
        <div className="error-banner">{error}</div>
        <Link className="btn btn-primary" to="/">
          Back home
        </Link>
      </div>
    );
  }

  if (!score) return <p className="muted">Loading coach report…</p>;

  return (
    <div className="stack-md">
      <Link to="/reports" className="muted">
        ← Reports
      </Link>
      <h1 className="page-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
        Coach feedback
      </h1>
      <JourneyStepper active="feedback" />

      <section className="panel stack-md">
        <div className="score-hero">
          <div className="num">{score.overall}</div>
          <span className={`badge ${score.passed ? "pass" : "fail"}`}>
            {score.passed ? "Passed" : "Below pass mark"}
          </span>
        </div>
        <p className="muted">{score.coachNotes}</p>

        {score.metrics && (
          <div className="metric-grid">
            <div className="metric-card">
              <div className="label">Talk / listen</div>
              <div className="value" style={{ fontSize: "1.5rem" }}>
                {Math.round(score.metrics.talkListenRatio * 100)}%
              </div>
            </div>
            <div className="metric-card">
              <div className="label">Questions</div>
              <div className="value" style={{ fontSize: "1.5rem" }}>
                {score.metrics.questionsAsked}
              </div>
            </div>
            <div className="metric-card">
              <div className="label">Fillers</div>
              <div className="value" style={{ fontSize: "1.5rem" }}>
                {score.metrics.fillerWordCount}
              </div>
            </div>
          </div>
        )}

        <div>
          <h2>Criteria</h2>
          <div className="criteria" style={{ marginTop: "0.75rem" }}>
            {score.criteria.map((c) => (
              <div key={c.id} className="criterion">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <strong>
                    {c.name}{" "}
                    <span className="muted" style={{ fontWeight: 500 }}>
                      ({c.weight}%)
                    </span>
                  </strong>
                  <span>{c.score}</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2>Strengths</h2>
          <ul className="list-check" style={{ marginTop: "0.5rem" }}>
            {score.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h2>Improvements</h2>
          <ul className="list-check" style={{ marginTop: "0.5rem" }}>
            {score.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="actions">
          {scenarioId && (
            <Link className="btn btn-primary" to={`/scenarios/${scenarioId}/setup`}>
              Practice again
            </Link>
          )}
          <Link className="btn btn-ghost" to="/reports">
            All reports
          </Link>
          <Link className="btn btn-ghost" to="/">
            Practice
          </Link>
        </div>
      </section>
    </div>
  );
}
