import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, HttpError } from "@/shared/api/client";
import { useAuth } from "@/modules/auth/AuthContext";
import { loadSetup } from "@/modules/scenarios/SetupPage";
import { JourneyStepper } from "@/shared/ui/JourneyStepper";
import { GeminiLiveSession } from "./geminiLiveSession";
import { VoiceOrb } from "./VoiceOrb";

type VoiceRuntime = {
  provider: "gemini";
  config: Record<string, unknown>;
  initialLanguage?: string;
  languageLabel?: string;
  voice?: string;
  initialBotMessage?: string;
  agentVariables?: Record<string, string>;
};

type Turn = {
  speaker: string;
  text: string;
  startedAtMs?: number;
  endedAtMs?: number;
  /** False once the utterance is sealed (turn complete / interrupt / speaker change) */
  open?: boolean;
};

type LatencyEvent = { name: string; atMs: number; meta?: Record<string, unknown> };

type CallPhase = "idle" | "connecting" | "live" | "ending" | "error";

type LiveHandle = {
  stop: () => Promise<void> | void;
};

export function PracticePage() {
  const { scenarioId = "" } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [participantName, setParticipantName] = useState("Agent");
  const [callDurationMin, setCallDurationMin] = useState(5);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);
  const [orbLevel, setOrbLevel] = useState(0);
  const [speaking, setSpeaking] = useState<"user" | "bot" | "idle">("idle");
  const liveRef = useRef<LiveHandle | null>(null);
  const participantRef = useRef("Agent");
  const t0 = useRef<number>(0);
  const latency = useRef<LatencyEvent[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  const phaseRef = useRef<CallPhase>("idle");
  const sessionIdRef = useRef<string | null>(null);
  const finishingRef = useRef(false);
  const transcriptBodyRef = useRef<HTMLDivElement | null>(null);
  const callLimitMsRef = useRef<number>(5 * 60_000);

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const el = transcriptBodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns]);

  useEffect(() => {
    return () => {
      void liveRef.current?.stop();
    };
  }, []);

  // Countdown while live; auto end when scenario call budget is exhausted.
  useEffect(() => {
    if (phase !== "live") return;
    const startedAt = performance.now();
    const tick = () => {
      const leftMs = callLimitMsRef.current - (performance.now() - startedAt);
      const leftSec = Math.max(0, Math.ceil(leftMs / 1000));
      setRemainingSec(leftSec);
      if (leftMs <= 0 && !finishingRef.current) {
        void endAndScore();
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
    // endAndScore is stable enough via refs; only re-arm when entering live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /**
   * Merge streaming chunks into one bubble while the turn is open.
   * Sealed turns (`final` / `open: false`) stay put; next same-speaker speech is a new bubble.
   */
  function pushTurn(turn: Turn & { final?: boolean }) {
    setTurns((prev) => {
      const nextOpen = turn.final === true ? false : turn.open !== false;
      const nextText = turn.text.trim();
      if (!nextText && prev.length === 0) return prev;

      if (prev.length === 0) {
        return [{ ...turn, text: nextText, open: nextOpen }];
      }

      const last = prev[prev.length - 1];
      const sameSpeaker = last.speaker === turn.speaker;
      const lastOpen = last.open !== false;

      if (!sameSpeaker || !lastOpen) {
        const sealed =
          lastOpen && last.speaker !== turn.speaker
            ? { ...last, open: false }
            : last;
        const head = lastOpen && last.speaker !== turn.speaker
          ? [...prev.slice(0, -1), sealed]
          : prev;
        return [...head, { ...turn, text: nextText, open: nextOpen }];
      }

      const prevText = last.text.trim();
      let text = nextText;
      if (prevText && nextText) {
        if (nextText === prevText || nextText.startsWith(prevText)) {
          text = nextText;
        } else if (prevText.startsWith(nextText) || prevText.endsWith(nextText)) {
          text = prevText;
        } else {
          // Delta chunk from Live STT — keep one bubble
          text = `${prevText} ${nextText}`;
        }
      } else {
        text = prevText || nextText;
      }

      const merged: Turn = {
        ...last,
        text,
        open: nextOpen,
        startedAtMs: last.startedAtMs ?? turn.startedAtMs,
        endedAtMs: turn.final ? (turn.endedAtMs ?? last.endedAtMs) : last.endedAtMs,
      };
      return [...prev.slice(0, -1), merged];
    });
  }

  function markFirstAgentAudio() {
    if (!latency.current.some((e) => e.name === "first_agent_audio")) {
      latency.current.push({
        name: "first_agent_audio",
        atMs: Math.round(performance.now() - t0.current),
      });
    }
  }

  async function endAndScore() {
    if (finishingRef.current) return;
    const id = sessionIdRef.current;
    if (!id) return;
    finishingRef.current = true;
    setPhase("ending");
    setOrbLevel(0.2);
    setSpeaking("idle");
    setError(null);
    try {
      await liveRef.current?.stop();
    } catch {
      /* ignore hangup races */
    }
    liveRef.current = null;

    const tScore0 = performance.now();
    const transcriptTurns =
      turnsRef.current.length > 0
        ? turnsRef.current
        : [{ speaker: "System", text: "(no speech captured)" }];

    try {
      await api(`/sessions/${id}/complete`, {
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
      navigate(`/sessions/${id}/feedback`);
    } catch (err) {
      finishingRef.current = false;
      setPhase("error");
      setError(err instanceof HttpError ? err.message : "Scoring failed");
    }
  }

  async function startGeminiCall(created: {
    voiceRuntime: VoiceRuntime;
    language?: string;
    languageLabel?: string;
    voice?: string;
    callDurationMin?: number;
    participantGender?: "male" | "female";
    participantName?: string;
  }) {
    const runtime = created.voiceRuntime;
    const cfg = runtime.config;
    const durationMin = Math.min(
      25,
      Math.max(3, Number(created.callDurationMin ?? cfg.callDurationMin ?? 5)),
    );
    callLimitMsRef.current = durationMin * 60_000;
    setCallDurationMin(durationMin);
    setRemainingSec(durationMin * 60);

    const gemini = new GeminiLiveSession({
      onOpen: () => {
        latency.current.push({
          name: "ws_connected",
          atMs: Math.round(performance.now() - t0.current),
        });
        setPhase("live");
        setSpeaking("idle");
      },
      onTranscript: (role, text, meta) => {
        if (role === "bot") {
          markFirstAgentAudio();
          pushTurn({
            speaker: participantRef.current,
            text,
            startedAtMs: Math.round(performance.now() - t0.current),
            final: meta?.final === true,
          });
        } else {
          pushTurn({
            speaker: "Learner",
            text,
            startedAtMs: Math.round(performance.now() - t0.current),
            final: meta?.final === true,
          });
        }
      },
      onLevel: (level) => setOrbLevel(level),
      onSpeaking: (who) => setSpeaking(who),
      onEnd: () => {
        if (finishingRef.current) return;
        if (phaseRef.current === "live" || phaseRef.current === "connecting") {
          void endAndScore();
        }
      },
      onError: (message) => {
        if (finishingRef.current) return;
        setPhase("error");
        setError(message);
      },
    });

    liveRef.current = gemini;

    const languageCode = String(cfg.languageCode ?? created.language ?? "en-IN");
    const voiceName = String(cfg.voiceName ?? runtime.voice ?? created.voice ?? "Kore");

    await gemini.start({
      authToken: token,
      model: String(cfg.model ?? "gemini-3.8-live"),
      voiceName,
      languageCode,
      languageLabel: String(
        cfg.languageLabel ?? created.languageLabel ?? runtime.languageLabel ?? "English",
      ),
      // Mint maps voiceId → Gemini voice_name (same as voiceName for current catalog)
      voiceId: voiceName,
      gender: created.participantGender === "male" ? "male" : "female",
      participantName: created.participantName || participantRef.current,
      agentVariables: runtime.agentVariables ?? {},
      callDurationMin: durationMin,
      kickoffMessage:
        runtime.initialBotMessage ||
        "Please greet me briefly and start the practice conversation.",
    });
  }

  async function startCall() {
    setError(null);
    setPhase("connecting");
    setTurns([]);
    setOrbLevel(0.2);
    setSpeaking("idle");
    finishingRef.current = false;
    latency.current = [];
    t0.current = performance.now();

    const setup = loadSetup(scenarioId);

    try {
      const created = await api<{
        sessionId: string;
        participantName?: string;
        participantGender?: "male" | "female";
        language?: string;
        languageLabel?: string;
        voice?: string;
        practiceCallMin?: number;
        callDurationMin?: number;
        voiceRuntime?: VoiceRuntime;
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
      sessionIdRef.current = created.sessionId;
      const name = created.participantName || "Agent";
      setParticipantName(name);
      participantRef.current = name;
      setHint(created.tips?.micGainHint ?? null);
      latency.current.push({
        name: "session_created",
        atMs: Math.round(performance.now() - t0.current),
      });

      if (!created.voiceRuntime) {
        throw new Error("Missing Gemini voiceRuntime from session create");
      }
      await startGeminiCall({
        voiceRuntime: created.voiceRuntime,
        language: created.language,
        languageLabel: created.languageLabel,
        voice: created.voice,
        callDurationMin: created.callDurationMin ?? created.practiceCallMin,
        participantGender: created.participantGender,
        participantName: created.participantName,
      });

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
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {phase === "live" && remainingSec != null && (
            <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")} left
              <span style={{ opacity: 0.7 }}> · {callDurationMin} min call</span>
            </span>
          )}
          {phase === "live" && (
            <span className="live-badge">
              <span className="dot" />
              Live session
            </span>
          )}
        </div>
      </div>

      <div className="call-layout">
        <section className="panel call-stage call-stage--voice">
          <p className="voice-orb-label">
            {phase === "live"
              ? speaking === "user"
                ? "YOU"
                : speaking === "bot"
                  ? participantName.toUpperCase()
                  : "LISTENING"
              : phase === "connecting"
                ? "CONNECTING"
                : phase === "ending"
                  ? "SCORING"
                  : "READY"}
          </p>

          <VoiceOrb
            level={
              phase === "live"
                ? orbLevel
                : phase === "connecting" || phase === "ending"
                  ? 0.25
                  : 0.08
            }
            active={phase === "live" || phase === "connecting" || phase === "ending"}
          />

          <div className="voice-orb-caption">
            {phase === "idle" && "Ready when you are"}
            {phase === "connecting" && "Connecting…"}
            {phase === "live" &&
              (speaking === "user"
                ? "You're speaking"
                : speaking === "bot"
                  ? `${participantName} is speaking`
                  : `${participantName} is listening…`)}
            {phase === "ending" && "Scoring your call…"}
            {phase === "error" && "Something went wrong"}
          </div>

          {hint && phase !== "live" && (
            <p className="muted" style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
              {hint}
            </p>
          )}

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
          <div className="call-transcript-body" ref={transcriptBodyRef}>
            {turns.length === 0 ? (
              <p className="muted call-transcript-empty">
                Turns will appear here once the call starts.
              </p>
            ) : (
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
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
