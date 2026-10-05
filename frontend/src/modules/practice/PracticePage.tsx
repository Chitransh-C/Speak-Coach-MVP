import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ConversationAgent,
  BrowserAudioInterface,
  InteractionType,
} from "sarvam-conv-ai-sdk/browser";
import { api, HttpError } from "@/shared/api/client";
import { getApiOrigin } from "@/shared/config/env";
import { useAuth } from "@/modules/auth/AuthContext";
import { loadSetup } from "@/modules/scenarios/SetupPage";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";

type AgentConfig = {
  orgId: string;
  workspaceId: string;
  appId: string;
  version: number;
  proxyBaseUrl: string;
  initialLanguage?: string;
  sarvamLanguageName?: string;
  voice?: string;
  initialBotMessage?: string;
  agentVariables?: Record<string, string>;
};

type Turn = {
  speaker: string;
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
};

type LatencyEvent = { name: string; atMs: number; meta?: Record<string, unknown> };

type CallPhase = "idle" | "connecting" | "live" | "ending" | "error";

export function PracticePage() {
  const { scenarioId = "" } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("Agent");
  const agentRef = useRef<ConversationAgent | null>(null);
  const participantRef = useRef("Agent");
  const t0 = useRef<number>(0);
  const latency = useRef<LatencyEvent[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const phaseRef = useRef<CallPhase>("idle");
  const transcriptBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const el = transcriptBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

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

    const setup = loadSetup(scenarioId);

    try {
      const created = await api<{
        sessionId: string;
        participantName?: string;
        language?: string;
        sarvamLanguageName?: string;
        voice?: string;
        agent: AgentConfig;
        tips?: { micGainHint?: string };
      }>("/sessions", {
        method: "POST",
        token,
        body: JSON.stringify({
          scenarioId,
          language: setup?.language,
          voice: setup?.voice,
        }),
      });
      setSessionId(created.sessionId);
      const name = created.participantName || "Agent";
      setParticipantName(name);
      participantRef.current = name;
      setHint(created.tips?.micGainHint ?? null);
      latency.current.push({
        name: "session_created",
        atMs: Math.round(performance.now() - t0.current),
      });

      const proxyBase = created.agent.proxyBaseUrl.startsWith("http")
        ? created.agent.proxyBaseUrl
        : `${getApiOrigin()}${created.agent.proxyBaseUrl}`;
      const baseUrl = proxyBase.endsWith("/") ? proxyBase : `${proxyBase}/`;

      const languageName =
        created.agent.sarvamLanguageName ||
        created.sarvamLanguageName ||
        "English";

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
          // Sarvam expects LanguageName enum strings (e.g. "English"), not BCP-47.
          initial_language_name: languageName as never,
          // Only pass an explicit bot message when the server provided one
          // (English). Non-English starts without it so the agent opens in-language.
          ...(created.agent.initialBotMessage
            ? { initial_bot_message: created.agent.initialBotMessage }
            : {}),
          agent_variables: created.agent.agentVariables ?? {},
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
              speaker: participantRef.current,
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
        : [{ speaker: "System", text: "(no speech captured)" }];

    try {
      await api(`/sessions/${sessionId}/complete`, {
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
      <Link to={`/scenarios/${scenarioId}/setup`} className="muted">
        ← Setup
      </Link>
      <h1 className="page-title" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)" }}>
        Practice with {participantName}
      </h1>
      <JourneyStepper
        active="practice"
        liveLabel={phase === "live" ? "Live call" : undefined}
      />

      <div className="call-meta-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          <span className="partner-avatar">
            {participantName
              .split(/\s+/)
              .slice(0, 2)
              .map((p) => p[0])
              .join("")}
          </span>
          <div>
            <div className="partner-name">{participantName}</div>
            <div className="partner-role">AI role-play partner</div>
          </div>
        </div>
        {phase === "live" && (
          <span className="live-badge">
            <span className="dot" />
            Live session
          </span>
        )}
      </div>

      <div className="call-layout">
        <section className="panel call-stage">
          <div
            className={`orb ${phase === "live" ? "listening" : ""} ${phase === "idle" || phase === "error" ? "idle" : ""}`}
            aria-hidden
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2>
              {phase === "idle" && "Ready when you are"}
              {phase === "connecting" && "Connecting…"}
              {phase === "live" && `${participantName} is listening…`}
              {phase === "ending" && "Scoring your call…"}
              {phase === "error" && "Something went wrong"}
            </h2>
            <p className="muted" style={{ marginTop: "0.4rem" }}>
              Allow microphone access. Prefer a headset for clearer capture.
            </p>
            {hint && (
              <p className="muted" style={{ marginTop: "0.35rem", fontSize: "0.85rem" }}>
                {hint}
              </p>
            )}
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="actions" style={{ justifyContent: "center", position: "relative", zIndex: 1 }}>
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

        <section className="panel call-transcript">
          <h2 className="call-transcript-head">Live transcript</h2>
          {turns.length === 0 ? (
            <p className="muted call-transcript-empty" style={{ marginTop: "1rem" }}>
              Turns will appear here once the call starts.
            </p>
          ) : (
            <div className="call-transcript-body" ref={transcriptBodyRef}>
              <div className="dialogue">
                {turns.map((t, i) => (
                  <div
                    key={`${t.speaker}-${i}`}
                    className={`bubble ${t.speaker === "Learner" ? "learner" : "agent"}`}
                  >
                    <div className="who">{t.speaker}</div>
                    <div>{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
