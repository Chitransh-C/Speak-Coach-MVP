import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ score: Score | null }>(`/api/v1/sessions/${sessionId}`, { token })
      .then((res) => {
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
      <Link to="/" className="muted">
        ← Home
      </Link>
      <h1>Coach feedback</h1>
      <div className="steps">
        <span className="step done">learn</span>
        <span className="step done">watch</span>
        <span className="step done">practice</span>
        <span className="step active">feedback</span>
      </div>

      <section className="panel stack-md">
        <div className="score-hero">
          <div className="num">{score.overall}</div>
          <span className={`badge ${score.passed ? "pass" : "fail"}`}>
            {score.passed ? "Passed" : "Below pass mark"}
          </span>
        </div>
        <p className="muted">{score.coachNotes}</p>

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
          <Link className="btn btn-primary" to="/scenarios/scenario-001/practice">
            Practice again
          </Link>
          <Link className="btn btn-ghost" to="/">
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
