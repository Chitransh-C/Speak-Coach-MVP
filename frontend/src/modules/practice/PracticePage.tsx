import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ConversationAgent,
  BrowserAudioInterface,
  InteractionType,
} from "sarvam-conv-ai-sdk/browser";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";

type AgentConfig = {
  orgId: string;
  workspaceId: string;
  appId: string;
  version: number;
  proxyBaseUrl: string;
};

type Turn = {
  speaker: "Alex" | "Learner" | "System";
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
};

type LatencyEvent = { name: string; atMs: number; meta?: Record<string, unknown> };

type CallPhase = "idle" | "connecting" | "live" | "ending" | "error";

export function PracticePage() {
  const { scenarioId = "scenario-001" } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const agentRef = useRef<ConversationAgent | null>(null);
  const t0 = useRef<number>(0);
  const latency = useRef<LatencyEvent[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const phaseRef = useRef<CallPhase>("idle");

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    return () => {
      void agentRef.current?.stop();
    };
  }, []);

  function pushTurn(turn: Turn) {
    setTurns((prev) => [...prev, turn]);
  }

  async function startCall() {
    setError(null);
    setPhase("connecting");
    setTurns([]);
    latency.current = [];
    t0.current = performance.now();

    try {
      const created = await api<{
        sessionId: string;
        agent: AgentConfig;
        tips?: { micGainHint?: string };
      }>("/api/v1/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({ scenarioId }),
      });
      setSessionId(created.sessionId);
      setHint(created.tips?.micGainHint ?? null);
      latency.current.push({
        name: "session_created",
        atMs: Math.round(performance.now() - t0.current),
      });

      const proxyBase = created.agent.proxyBaseUrl.startsWith("http")
        ? created.agent.proxyBaseUrl
        : `${window.location.origin}${created.agent.proxyBaseUrl}`;
      const baseUrl = proxyBase.endsWith("/") ? proxyBase : `${proxyBase}/`;

      const audioInterface = new BrowserAudioInterface(16000);
      const agent = new ConversationAgent({
        apiKey: "",
        baseUrl,
        platform: "browser",
        audioInterface,
        config: {
          org_id: created.agent.orgId,
          workspace_id: created.agent.workspaceId,
          app_id: created.agent.appId,
          version: created.agent.version,
          interaction_type: InteractionType.CALL,
          user_identifier_type: "email",
          user_identifier: user?.email ?? "learner@speakcoach.local",
          input_sample_rate: 16000,
          output_sample_rate: 16000,
        },
        startCallback: async () => {
          latency.current.push({
            name: "ws_connected",
            atMs: Math.round(performance.now() - t0.current),
          });
          setPhase("live");
        },
        transcriptCallback: async (msg) => {
          const text = (msg.content || "").trim();
          if (!text) return;
          if (msg.role === "bot") {
            if (!latency.current.some((e) => e.name === "first_agent_audio")) {
              latency.current.push({
                name: "first_agent_audio",
                atMs: Math.round(performance.now() - t0.current),
              });
            }
            pushTurn({
              speaker: "Alex",
              text,
              startedAtMs: Math.round(performance.now() - t0.current),
            });
          } else {
            pushTurn({
              speaker: "Learner",
              text,
              startedAtMs: Math.round(performance.now() - t0.current),
            });
          }
        },
        endCallback: async () => {
          if (phaseRef.current === "live") setPhase("idle");
        },
      });

      agentRef.current = agent;
      await agent.start();
      latency.current.push({
        name: "start_session_resolved",
        atMs: Math.round(performance.now() - t0.current),
      });
      setPhase("live");
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof HttpError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not start call",
      );
    }
  }

  async function endAndScore() {
    if (!sessionId) return;
    setPhase("ending");
    setError(null);
    try {
      await agentRef.current?.stop();
    } catch {
      /* ignore hangup races */
    }
    agentRef.current = null;

    const tScore0 = performance.now();
    const transcriptTurns =
      turnsRef.current.length > 0
        ? turnsRef.current
        : [{ speaker: "System" as const, text: "(no speech captured)" }];

    try {
      await api(`/api/v1/sessions/${sessionId}/complete`, {
        method: "POST",
        token,
        body: JSON.stringify({
          endedAt: new Date().toISOString(),
          transcript: { turns: transcriptTurns },
          latency: {
            events: [
              ...latency.current,
              {
                name: "score_request",
                atMs: Math.round(performance.now() - t0.current),
              },
            ],
          },
        }),
      });
      latency.current.push({
        name: "score_done",
        atMs: Math.round(performance.now() - t0.current),
        meta: { scoreMs: Math.round(performance.now() - tScore0) },
      });
      navigate(`/sessions/${sessionId}/feedback`);
    } catch (err) {
      setPhase("error");
      setError(err instanceof HttpError ? err.message : "Scoring failed");
    }
  }

  return (
    <div className="stack-md">
      <Link to={`/scenarios/${scenarioId}/watch`} className="muted">
        ← Watch
      </Link>
      <h1>Practice with Alex</h1>
      <div className="steps">
        <span className="step done">learn</span>
        <span className="step done">watch</span>
        <span className="step active">practice</span>
        <span className="step">feedback</span>
      </div>

      <section className="panel call-stage">
        <div
          className={`orb ${phase === "live" ? "listening" : ""} ${phase === "idle" || phase === "error" ? "idle" : ""}`}
          aria-hidden
        />
        <div>
          <h2>
            {phase === "idle" && "Ready when you are"}
            {phase === "connecting" && "Connecting…"}
            {phase === "live" && "You’re live — speak clearly"}
            {phase === "ending" && "Scoring your call…"}
            {phase === "error" && "Something went wrong"}
          </h2>
          <p className="muted" style={{ marginTop: "0.4rem" }}>
            Allow microphone access. Prefer a headset. Laptop array mics often need more gain.
          </p>
          {hint && (
            <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
              {hint}
            </p>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="actions" style={{ justifyContent: "center" }}>
          {(phase === "idle" || phase === "error") && (
            <button className="btn btn-accent" type="button" onClick={() => void startCall()}>
              Start call
            </button>
          )}
          {phase === "live" && (
            <button className="btn btn-danger" type="button" onClick={() => void endAndScore()}>
              End & score
            </button>
          )}
          {(phase === "connecting" || phase === "ending") && (
            <button className="btn btn-ghost" type="button" disabled>
              Please wait…
            </button>
          )}
        </div>
      </section>

      {turns.length > 0 && (
        <section className="panel">
          <h2>Live transcript</h2>
          <div className="dialogue" style={{ marginTop: "1rem" }}>
            {turns.map((t, i) => (
              <div
                key={`${t.speaker}-${i}`}
                className={`bubble ${t.speaker === "Alex" ? "alex" : "learner"}`}
              >
                <div className="who">{t.speaker}</div>
                <div>{t.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
