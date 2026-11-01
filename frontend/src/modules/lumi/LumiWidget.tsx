import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/AuthContext";
import { GeminiLiveSession } from "@/modules/practice/geminiLiveSession";
import { LUMI_CALL_DURATION_MIN, LUMI_CLIENT_TOOLS } from "./lumiTools";
import { appendLumiTurn, finalizeLumiTurn } from "./lumiHistory";
import { dispatchLumiTool } from "./lumiToolDispatcher";

type Pos = { x: number; y: number };

const POS_KEY = "rolesmith_lumi_pos";

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return { x: 24, y: 24 };
    const p = JSON.parse(raw) as Pos;
    if (typeof p.x === "number" && typeof p.y === "number") return p;
  } catch {
    /* ignore */
  }
  return { x: 24, y: 24 };
}

function clampPos(p: Pos): Pos {
  const size = 96;
  const maxX = Math.max(8, window.innerWidth - size - 8);
  const maxY = Math.max(8, window.innerHeight - size - 8);
  return {
    x: Math.min(maxX, Math.max(8, p.x)),
    y: Math.min(maxY, Math.max(8, p.y)),
  };
}

function isPracticePath(pathname: string) {
  return /\/scenarios\/[^/]+\/practice\/?$/.test(pathname);
}

type Phase = "idle" | "connecting" | "awake" | "error";

export function LumiWidget() {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pos, setPos] = useState<Pos>(() => clampPos(loadPos()));
  const [phase, setPhase] = useState<Phase>("idle");
  const [speaking, setSpeaking] = useState<"user" | "bot" | "idle">("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(LUMI_CALL_DURATION_MIN * 60);

  const sessionRef = useRef<GeminiLiveSession | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const timerRef = useRef<number | null>(null);
  const hidePractice = isPracticePath(location.pathname);

  useEffect(() => {
    function onResize() {
      setPos((p) => clampPos(p));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (hidePractice && sessionRef.current) {
      void sleepNow("practice_page");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidePractice]);

  useEffect(() => {
    return () => {
      void sleepNow("unmount");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function sleepNow(reason: string) {
    clearTimer();
    const s = sessionRef.current;
    sessionRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* ignore */
      }
    }
    setPhase("idle");
    setSpeaking("idle");
    setLevel(0);
    setSecondsLeft(LUMI_CALL_DURATION_MIN * 60);
    if (reason && reason !== "unmount") {
      /* keep error only for real failures */
    }
  }

  async function wake() {
    if (!user || !token || hidePractice) return;
    if (phase === "connecting" || phase === "awake") return;
    setError(null);
    setPhase("connecting");

    const live = new GeminiLiveSession({
      onOpen: () => {
        setPhase("awake");
        setSecondsLeft(LUMI_CALL_DURATION_MIN * 60);
        clearTimer();
        timerRef.current = window.setInterval(() => {
          setSecondsLeft((sec) => {
            if (sec <= 1) {
              clearTimer();
              void sleepNow("timeout");
              return 0;
            }
            return sec - 1;
          });
        }, 1000);
      },
      onTranscript: (role, text, meta) => {
        if (!user) return;
        if (meta?.final) {
          finalizeLumiTurn(user.id, role, text);
        } else {
          appendLumiTurn(user.id, role, text);
        }
      },
      onLevel: setLevel,
      onSpeaking: setSpeaking,
      onError: (msg) => {
        setError(msg);
        setPhase("error");
      },
      onEnd: () => {
        clearTimer();
        sessionRef.current = null;
        setPhase("idle");
        setSpeaking("idle");
        setLevel(0);
      },
      onToolCall: async (name, args) =>
        dispatchLumiTool(name, args, {
          token,
          userId: user.id,
          navigate,
        }),
    });

    sessionRef.current = live;

    try {
      const minted = await GeminiLiveSession.mintAssistantToken(token, {
        languageCode: "en-IN",
        voiceId: "Aoede",
      });
      await live.start({
        authToken: token,
        model: minted.model,
        voiceName: minted.voiceName,
        languageCode: minted.languageCode || "en-IN",
        languageLabel: "English (India)",
        voiceId: "Aoede",
        gender: "female",
        participantName: "Lumi",
        agentVariables: {},
        callDurationMin: minted.callDurationMin || LUMI_CALL_DURATION_MIN,
        preMinted: {
          token: minted.token,
          model: minted.model,
          voiceName: minted.voiceName,
          languageCode: minted.languageCode || "en-IN",
          callDurationMin: minted.callDurationMin,
        },
        tools: LUMI_CLIENT_TOOLS,
        endSessionTools: ["sleep"],
        kickoffMessage:
          "Wake up as Lumi. Greet me briefly, say you can help with scenarios, practice, reports, and navigation, and ask what I need.",
      });
    } catch (err) {
      sessionRef.current = null;
      setPhase("error");
      setError(err instanceof Error ? err.message : "Could not wake Lumi");
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.moved) return;
    const next = clampPos({ x: d.origX - dx, y: d.origY - dy });
    // Position is bottom-right anchored via CSS right/bottom
    setPos(next);
  }

  function onPointerUp(e: ReactPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (d.moved) {
      setPos((p) => {
        const clamped = clampPos(p);
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(clamped));
        } catch {
          /* ignore */
        }
        return clamped;
      });
      return;
    }
    if (phase === "idle" || phase === "error") {
      void wake();
    } else if (phase === "awake") {
      void sleepNow("user_click");
    }
  }

  if (!user || hidePractice) return null;

  const awake = phase === "awake" || phase === "connecting";
  const pulse = awake ? 1 + level * 0.15 : 1;

  return (
    <div
      className={`lumi-root ${awake ? "lumi-root--awake" : ""} ${speaking === "bot" ? "lumi-root--speaking" : ""}`}
      style={{ right: pos.x, bottom: pos.y }}
    >
      {(phase === "idle" || phase === "error") && (
        <div className="lumi-bubble" role="status">
          {error ? error : 'Click to wake me'}
        </div>
      )}
      {phase === "awake" && (
        <div className="lumi-timer" aria-hidden>
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
        </div>
      )}
      <button
        type="button"
        className="lumi-orb"
        style={{ transform: `scale(${pulse})` }}
        aria-label={awake ? "Put Lumi to sleep" : "Wake Lumi"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="lumi-face" aria-hidden>
          <span className="lumi-eye lumi-eye--l" />
          <span className="lumi-eye lumi-eye--r" />
          <span className="lumi-smile" />
        </span>
        <span className="lumi-sparkles" aria-hidden />
      </button>
      {phase === "connecting" && <p className="lumi-status">Waking…</p>}
    </div>
  );
}
