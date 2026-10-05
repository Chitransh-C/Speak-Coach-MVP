import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";

type Evidence = {
  timestampMs?: number | null;
  quote: string;
  note: string;
};

type Criterion = {
  id: string;
  name: string;
  weight: number;
  score: number;
  feedback?: string;
  evidence?: Evidence[];
};

type Score = {
  overall: number;
  passed: boolean;
  passMark?: number;
  criteria: Criterion[];
  strengths: string[];
  improvements: string[];
  coachNotes: string;
  metrics?: { talkListenRatio: number; questionsAsked: number; fillerWordCount: number };
  model?: string;
};

type Turn = {
  speaker: string;
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
};

type SessionPayload = {
  score: Score | null;
  scenarioId: string;
  scenarioTitle?: string;
  passMark?: number;
  participantName?: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: Turn[] | null;
};

function formatTurnTime(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return null;
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const CRITERION_PASS = 70;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Score 0-100 → 1-5 band for rubric display. */
function scoreOutOfFive(score: number) {
  return clamp(Math.round(score / 20), 1, 5);
}

function pointsEarned(c: Criterion) {
  return (c.score / 100) * c.weight;
}

function learnerTalkShare(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0.5;
  if (ratio <= 1) return ratio;
  return ratio / (1 + ratio);
}

function formatDuration(startedAt?: string, endedAt?: string) {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function criterionTone(score: number): "pass" | "mid" | "fail" {
  if (score >= CRITERION_PASS) return "pass";
  if (score >= 45) return "mid";
  return "fail";
}

function criterionFeedback(c: Criterion) {
  if (c.feedback?.trim()) return c.feedback.trim();
  const notes = (c.evidence ?? []).map((e) => e.note).filter(Boolean);
  return notes.join(" ");
}

function ScoreRing({ value }: { value: number }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp(value, 0, 100) / 100);
  return (
    <div className="fb-ring" aria-label={`Score ${value} out of 100`}>
      <svg viewBox="0 0 120 120">
        <circle className="fb-ring-track" cx="60" cy="60" r={r} />
        <circle
          className="fb-ring-value"
          cx="60"
          cy="60"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="fb-ring-label">
        <span className="num">{Math.round(value)}</span>
        <span className="sub">/ 100</span>
      </div>
    </div>
  );
}

function ProfileDonut({
  criteria,
  passedCount,
}: {
  criteria: Criterion[];
  passedCount: number;
}) {
  const total = criteria.reduce((s, c) => s + c.weight, 0) || 1;
  let cursor = 0;
  const segments = criteria.map((c) => {
    const start = cursor;
    const sweep = (c.weight / total) * 360;
    cursor += sweep;
    return { ...c, start, sweep };
  });

  const gradient = segments
    .map((s) => {
      const color =
        criterionTone(s.score) === "pass"
          ? "#047857"
          : criterionTone(s.score) === "mid"
            ? "#d97706"
            : "#ba1a1a";
      return `${color} ${s.start}deg ${s.start + s.sweep}deg`;
    })
    .join(", ");

  return (
    <div className="fb-donut-wrap">
      <div className="fb-donut" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="fb-donut-hole">
          <span className="num">
            {passedCount}/{criteria.length}
          </span>
          <span className="sub">criteria passed</span>
        </div>
      </div>
    </div>
  );
}

export function FeedbackPage() {
  const { sessionId = "" } = useParams();
  const { token } = useAuth();
  const [score, setScore] = useState<Score | null>(null);
  const [meta, setMeta] = useState<Omit<SessionPayload, "score"> | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionPayload>(`/sessions/${sessionId}`, { token })
      .then((res) => {
        setMeta({
          scenarioId: res.scenarioId,
          scenarioTitle: res.scenarioTitle,
          passMark: res.passMark,
          participantName: res.participantName,
          startedAt: res.startedAt,
          endedAt: res.endedAt,
        });
        setTranscript(Array.isArray(res.transcript) ? res.transcript : []);
        if (!res.score) setError("Score not ready yet.");
        else setScore(res.score);
      })
      .catch((err) =>
        setError(err instanceof HttpError ? err.message : "Failed to load feedback"),
      );
  }, [sessionId, token]);

  const view = useMemo(() => {
    if (!score) return null;
    const passMark = score.passMark ?? meta?.passMark ?? 70;
    const criteria = [...score.criteria].sort((a, b) => a.score - b.score);
    const passedCount = score.criteria.filter((c) => c.score >= CRITERION_PASS).length;
    const delta = Math.round(score.overall - passMark);
    const headline = score.passed
      ? `${Math.abs(delta)} points clear of the pass mark.`
      : `${Math.abs(delta)} points short of a pass.`;
    const duration = formatDuration(meta?.startedAt, meta?.endedAt);
    const youShare = learnerTalkShare(score.metrics?.talkListenRatio ?? 0.5);
    const partnerShare = 1 - youShare;
    const partnerLabel = meta?.participantName || "partner";
    return {
      passMark,
      criteria,
      criteriaById: score.criteria,
      passedCount,
      headline,
      duration,
      youShare,
      partnerShare,
      partnerLabel,
    };
  }, [score, meta]);

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

  if (!score || !view) return <p className="muted">Loading coach report…</p>;

  return (
    <div className="fb-report stack-md">
      <div className="fb-topbar">
        <Link to="/reports" className="muted">
          ← All sessions
        </Link>
        <div className="fb-topbar-actions">
          {meta?.scenarioId && (
            <Link className="btn btn-primary" to={`/scenarios/${meta.scenarioId}/setup`}>
              Practice again
            </Link>
          )}
        </div>
      </div>

      <header className="fb-header">
        <p className="eyebrow">
          {meta?.scenarioTitle ?? "Practice session"}
          {meta?.participantName ? ` · with ${meta.participantName}` : ""}
        </p>
        <h1 className="page-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
          Coach report
        </h1>
        <JourneyStepper active="feedback" />
      </header>

      <section className="fb-hero panel">
        <div className="fb-hero-grid">
          <ScoreRing value={score.overall} />
          <div className="fb-hero-copy">
            <div className="fb-hero-badges">
              <span className={`badge ${score.passed ? "pass" : "fail"}`}>
                {score.passed ? "Passed" : "Failed"}
              </span>
              <span className="muted">pass mark {view.passMark}</span>
            </div>
            <h2>{view.headline}</h2>
            <p className="muted">
              {score.passed
                ? "Keep the strongest criteria below and stretch the weaker ones next run."
                : "It stays in Scenarios until you clear the mark. The weakest criteria below are where the points are."}
            </p>
            <p className="fb-meta">
              {view.duration ? `${view.duration} spoken · ` : ""}
              {view.passedCount} of {score.criteria.length} criteria passed
            </p>
          </div>
        </div>
      </section>

      <section className="fb-split">
        <article className="panel fb-list-card">
          <h2 className="fb-list-title ok">Strengths</h2>
          <ul className="fb-bullets">
            {score.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </article>
        <article className="panel fb-list-card">
          <h2 className="fb-list-title warn">To improve</h2>
          <ul className="fb-bullets">
            {score.improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="fb-split">
        <article className="panel stack-md">
          <div>
            <h2>Performance profile</h2>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Slice width is the criterion&apos;s share of the grade. Green is full marks, yellow is
              partial, red is a fail.
            </p>
          </div>
          <div className="fb-profile">
            <ProfileDonut criteria={score.criteria} passedCount={view.passedCount} />
            <ul className="fb-legend">
              {score.criteria.map((c) => (
                <li key={c.id}>
                  <span className={`dot ${criterionTone(c.score)}`} />
                  <div>
                    <strong>{c.name}</strong>
                    <span className="muted">
                      {scoreOutOfFive(c.score)}/5 · {c.weight}% of grade
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="panel stack-md">
          <div>
            <h2>Where the score came from</h2>
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              How much of each criterion you earned. The figures are points of the 100.
            </p>
          </div>
          <div className="fb-points">
            {score.criteria.map((c) => {
              const earned = pointsEarned(c);
              const pct = clamp(c.score, 0, 100);
              const tone = criterionTone(c.score);
              return (
                <div key={c.id} className="fb-points-row">
                  <div className="fb-points-head">
                    <strong>{c.name}</strong>
                    <span>
                      {earned.toFixed(1)} of {c.weight.toFixed(1)} pts · {Math.round(pct)}%
                    </span>
                  </div>
                  <div className="bar">
                    <span className={`fill-${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="panel stack-md">
        <div className="fb-rubric-head">
          <h2>Graded against the rubric</h2>
          <span className="pill">weakest first</span>
        </div>
        <div className="fb-rubric">
          {view.criteria.map((c) => {
            const tone = criterionTone(c.score);
            const feedback = criterionFeedback(c);
            return (
              <article key={c.id} className="fb-rubric-item">
                <div className="fb-rubric-title">
                  <span className={`fb-rubric-mark ${tone}`} aria-hidden>
                    {tone === "pass" ? "✓" : tone === "mid" ? "!" : "×"}
                  </span>
                  <div>
                    <h3>
                      {c.name}{" "}
                      <span className={`fb-score-frac ${tone}`}>
                        {scoreOutOfFive(c.score)}/5
                      </span>
                    </h3>
                    <p className="muted">{c.weight}% of grade</p>
                  </div>
                </div>
                <div className="bar">
                  <span className={`fill-${tone}`} style={{ width: `${clamp(c.score, 0, 100)}%` }} />
                </div>
                {feedback && <p className="fb-rubric-feedback">{feedback}</p>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="fb-split">
        <article className="panel stack-md">
          <h2>How you talked</h2>
          <div className="fb-talk-bar" aria-hidden>
            <span style={{ width: `${view.youShare * 100}%` }} />
          </div>
          <div className="fb-talk-labels">
            <span>{Math.round(view.youShare * 100)}% you</span>
            <span>
              {Math.round(view.partnerShare * 100)}% {view.partnerLabel}
            </span>
          </div>
          <div className="fb-stat-row">
            <div>
              <div className="label">Questions</div>
              <div className="value">{score.metrics?.questionsAsked ?? 0}</div>
            </div>
            <div>
              <div className="label">Filler words</div>
              <div className="value">{score.metrics?.fillerWordCount ?? 0}</div>
            </div>
          </div>
        </article>

        <article className="panel stack-md">
          <h2>Coach&apos;s notes</h2>
          {score.coachNotes.split(/\n\n+/).map((para) => (
            <p key={para.slice(0, 40)} className="fb-coach-para">
              {para}
            </p>
          ))}
        </article>
      </section>

      <section className="panel stack-md">
        <div className="fb-rubric-head">
          <h2>Call transcript</h2>
          <span className="pill">{transcript.length} turns</span>
        </div>
        {transcript.length === 0 ? (
          <p className="muted">No transcript was saved for this session.</p>
        ) : (
          <div className="dialogue fb-transcript">
            {transcript.map((t, i) => {
              const stamp = formatTurnTime(t.startedAtMs);
              const isLearner = /learner|user/i.test(t.speaker);
              return (
                <div
                  key={`${t.speaker}-${i}`}
                  className={`bubble ${isLearner ? "learner" : "agent"}`}
                >
                  <div className="who">
                    {t.speaker}
                    {stamp ? ` · ${stamp}` : ""}
                  </div>
                  <div>{t.text}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="actions">
        {meta?.scenarioId && (
          <Link className="btn btn-primary" to={`/scenarios/${meta.scenarioId}/setup`}>
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
    </div>
  );
}
