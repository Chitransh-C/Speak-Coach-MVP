import { GoogleGenAI, Modality, Type } from "@google/genai";
import { api } from "@/shared/api/client";
import { PcmPlayer, startMicCapture, type MicCaptureHandle } from "./geminiLiveAudio";

export type TranscriptMeta = {
  /** When true, close this speaker's bubble; next speech starts a new one */
  final?: boolean;
};

export type GeminiLiveCallbacks = {
  onOpen?: () => void;
  onTranscript?: (role: "user" | "bot", text: string, meta?: TranscriptMeta) => void;
  onEnd?: (reason: string) => void;
  onError?: (message: string) => void;
  /** Mic / bot energy 0..1 for the voice orb */
  onLevel?: (level01: number) => void;
  onSpeaking?: (who: "user" | "bot" | "idle") => void;
  /**
   * Handle a model tool call. Return a JSON-serializable object for sendToolResponse.
   * Return `{ __endSession: true, reason?: string }` (or set endSession) to gracefully stop.
   */
  onToolCall?: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown> | void> | Record<string, unknown> | void;
};

/** Merge cumulative STT or delta chunks into one utterance string. */
function mergeTranscriptChunk(prev: string, chunk: string): string {
  const p = prev.trim();
  const c = chunk.trim();
  if (!c) return p;
  if (!p) return c;
  if (c === p || c.startsWith(p)) return c;
  if (p.startsWith(c)) return p;
  if (p.endsWith(c)) return p;
  return `${p} ${c}`;
}

export type FunctionDeclarationConfig = {
  name: string;
  description: string;
  parameters: {
    type: typeof Type.OBJECT | typeof Type.STRING | typeof Type.NUMBER;
    properties?: Record<
      string,
      {
        type: typeof Type.OBJECT | typeof Type.STRING | typeof Type.NUMBER;
        description?: string;
      }
    >;
    required?: string[];
  };
};

export type GeminiLiveStartInput = {
  authToken: string | null | undefined;
  model: string;
  voiceName: string;
  languageCode: string;
  languageLabel: string;
  voiceId: string;
  gender: "male" | "female";
  participantName: string;
  agentVariables: Record<string, string>;
  callDurationMin: number;
  kickoffMessage?: string;
  /** When set, skip practice mint and connect with this token. */
  preMinted?: {
    token: string;
    model: string;
    voiceName: string;
    languageCode: string;
    callDurationMin?: number;
  };
  /** Override Live tools; default is practice end_call. */
  tools?: FunctionDeclarationConfig[];
  /** Tool names that should trigger graceful session end after response. */
  endSessionTools?: string[];
};

type LiveSession = {
  sendRealtimeInput: (payload: Record<string, unknown>) => void;
  sendClientContent: (payload: Record<string, unknown>) => void;
  sendToolResponse: (payload: Record<string, unknown>) => void;
  close: () => void;
};

const DEFAULT_PRACTICE_TOOLS: FunctionDeclarationConfig[] = [
  {
    name: "end_call",
    description: "End the live practice call.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING },
      },
      required: ["reason"],
    },
  },
];

/**
 * Browser ↔ Gemini Live (ephemeral token minted by RoleSmith).
 */
export class GeminiLiveSession {
  private session: LiveSession | null = null;
  private mic: MicCaptureHandle | null = null;
  private player = new PcmPlayer();
  private closed = false;
  private ending = false;
  private callbacks: GeminiLiveCallbacks;
  private botTranscript = "";
  private userTranscript = "";
  private pendingEndReason: string | null = null;
  private endPlaybackWait: Promise<void> | null = null;
  private endSessionTools = new Set<string>(["end_call"]);

  constructor(callbacks: GeminiLiveCallbacks) {
    this.callbacks = callbacks;
  }

  private finalizeBot() {
    if (!this.botTranscript) return;
    this.callbacks.onTranscript?.("bot", this.botTranscript, { final: true });
    this.botTranscript = "";
  }

  private finalizeUser() {
    if (!this.userTranscript) return;
    this.callbacks.onTranscript?.("user", this.userTranscript, { final: true });
    this.userTranscript = "";
  }

  static async mintToken(
    authToken: string | null | undefined,
    body: {
      languageCode: string;
      languageLabel: string;
      voiceId: string;
      gender: "male" | "female";
      participantName: string;
      agentVariables: Record<string, string>;
      callDurationMin: number;
    },
  ) {
    return api<{
      token: string;
      model: string;
      voiceName: string;
      languageCode: string;
      expiresAt: string;
      newSessionExpiresAt: string;
      callDurationMin: number;
    }>("/gemini/ephemeral-token", {
      method: "POST",
      token: authToken,
      body: JSON.stringify(body),
    });
  }

  static async mintAssistantToken(
    authToken: string | null | undefined,
    body?: { languageCode?: string; voiceId?: string },
  ) {
    return api<{
      token: string;
      model: string;
      voiceName: string;
      languageCode: string;
      expiresAt: string;
      newSessionExpiresAt: string;
      callDurationMin: number;
    }>("/gemini/assistant-token", {
      method: "POST",
      token: authToken,
      body: JSON.stringify(body ?? {}),
    });
  }

  async start(input: GeminiLiveStartInput) {
    const minted =
      input.preMinted ??
      (await GeminiLiveSession.mintToken(input.authToken, {
        languageCode: input.languageCode,
        languageLabel: input.languageLabel,
        voiceId: input.voiceId,
        gender: input.gender,
        participantName: input.participantName,
        agentVariables: input.agentVariables,
        callDurationMin: input.callDurationMin,
      }));

    const tools = input.tools?.length ? input.tools : DEFAULT_PRACTICE_TOOLS;
    this.endSessionTools = new Set(
      input.endSessionTools?.length
        ? input.endSessionTools
        : tools.some((t) => t.name === "end_call")
          ? ["end_call"]
          : tools.some((t) => t.name === "sleep")
            ? ["sleep"]
            : [],
    );

    const ai = new GoogleGenAI({
      apiKey: minted.token,
      httpOptions: { apiVersion: "v1beta" },
    });

    const model = minted.model || input.model;
    const voiceName = minted.voiceName || input.voiceName;
    const languageCode = minted.languageCode || input.languageCode;

    this.session = (await ai.live.connect({
      model,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        sessionResumption: {},
        contextWindowCompression: { slidingWindow: {} },
        // Cast: our mirrored declarations match Live Schema shape at runtime.
        tools: [{ functionDeclarations: tools as never }],
      },
      callbacks: {
        onopen: () => {
          this.callbacks.onOpen?.();
        },
        onmessage: (message) => {
          void this.handleMessage(message as unknown as Record<string, unknown>);
        },
        onerror: (e) => {
          const msg = e instanceof Error ? e.message : "Gemini Live error";
          this.callbacks.onError?.(msg);
        },
        onclose: () => {
          if (!this.ending && !this.closed) {
            this.callbacks.onEnd?.("remote_close");
          }
        },
      },
    })) as unknown as LiveSession;

    this.mic = await startMicCapture(
      (b64) => {
        if (this.closed || !this.session) return;
        try {
          this.session.sendRealtimeInput({
            audio: {
              data: b64,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        } catch {
          /* ignore send races while closing */
        }
      },
      (level) => {
        if (this.closed) return;
        this.callbacks.onLevel?.(level);
        if (level > 0.12) this.callbacks.onSpeaking?.("user");
      },
    );

    const kickoff =
      input.kickoffMessage?.trim() ||
      "Please greet me and start the practice call now.";
    this.session.sendClientContent({
      turns: [{ role: "user", parts: [{ text: kickoff }] }],
      turnComplete: true,
    });
  }

  private async handleMessage(message: Record<string, unknown>) {
    const serverContent = message.serverContent as
      | {
          interrupted?: boolean;
          turnComplete?: boolean;
          generationComplete?: boolean;
          modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
        }
      | undefined;

    if (serverContent?.interrupted) {
      this.player.flush();
      this.finalizeBot();
      this.callbacks.onSpeaking?.("idle");
    }

    const parts = serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        this.finalizeUser();
        this.callbacks.onSpeaking?.("bot");
        try {
          const binary = atob(data);
          let sum = 0;
          const n = Math.min(binary.length, 4000);
          for (let i = 0; i + 1 < n; i += 2) {
            const sample =
              ((binary.charCodeAt(i) | (binary.charCodeAt(i + 1) << 8)) << 16) >> 16;
            const f = sample / 0x8000;
            sum += f * f;
          }
          const rms = Math.sqrt(sum / Math.max(1, Math.floor(n / 2)));
          this.callbacks.onLevel?.(Math.min(1, rms * 6));
        } catch {
          this.callbacks.onLevel?.(0.45);
        }
        this.player.enqueueBase64Pcm(data, 24000);
      }
    }

    const inText = serverContent?.inputTranscription?.text?.trim();
    if (inText) {
      this.finalizeBot();
      this.callbacks.onSpeaking?.("user");
      this.userTranscript = mergeTranscriptChunk(this.userTranscript, inText);
      this.callbacks.onTranscript?.("user", this.userTranscript, { final: false });
    }

    const outText = serverContent?.outputTranscription?.text?.trim();
    if (outText) {
      this.finalizeUser();
      this.callbacks.onSpeaking?.("bot");
      this.botTranscript = mergeTranscriptChunk(this.botTranscript, outText);
      this.callbacks.onTranscript?.("bot", this.botTranscript, { final: false });
    }

    if (serverContent?.turnComplete || serverContent?.generationComplete) {
      this.finalizeBot();
      if (!serverContent?.interrupted) {
        this.callbacks.onSpeaking?.("idle");
      }
    }

    const toolCall = message.toolCall as
      | {
          functionCalls?: {
            id?: string;
            name?: string;
            args?: Record<string, unknown>;
          }[];
        }
      | undefined;

    if (toolCall?.functionCalls?.length) {
      const responses: { id?: string; name?: string; response: Record<string, unknown> }[] =
        [];
      let endReason: string | null = null;

      for (const fc of toolCall.functionCalls) {
        const name = fc.name || "unknown";
        const args = (fc.args && typeof fc.args === "object" ? fc.args : {}) as Record<
          string,
          unknown
        >;
        let result: Record<string, unknown> = { result: "ok" };

        if (this.callbacks.onToolCall) {
          try {
            const out = await this.callbacks.onToolCall(name, args);
            if (out && typeof out === "object") {
              result = out as Record<string, unknown>;
            }
          } catch (err) {
            result = {
              ok: false,
              error: err instanceof Error ? err.message : "Tool failed",
            };
          }
        } else if (name === "end_call") {
          result = { result: "ok" };
        }

        if (
          this.endSessionTools.has(name) ||
          result.__endSession === true ||
          result.endSession === true
        ) {
          endReason =
            (typeof result.reason === "string" && result.reason) ||
            (typeof args.reason === "string" && args.reason) ||
            name;
        }

        const { __endSession: _a, endSession: _b, ...safe } = result;
        responses.push({
          id: fc.id,
          name: fc.name,
          response: Object.keys(safe).length ? safe : { result: "ok" },
        });
      }

      try {
        this.session?.sendToolResponse({ functionResponses: responses });
      } catch {
        /* ignore */
      }
      if (endReason) {
        void this.beginGracefulEnd(endReason);
      }
    }
  }

  private async beginGracefulEnd(reason: string) {
    if (this.pendingEndReason || this.closed) return;
    this.ending = true;
    this.pendingEndReason = reason;
    try {
      this.mic?.stop();
    } catch {
      /* ignore */
    }
    this.mic = null;

    this.endPlaybackWait = (async () => {
      await new Promise((r) => setTimeout(r, 600));
      await this.player.drain(14_000);
      await new Promise((r) => setTimeout(r, 350));
      await this.player.drain(2_000);
      if (this.closed) return;
      await this.stop({ flushAudio: false });
      this.callbacks.onEnd?.(reason);
    })();

    await this.endPlaybackWait;
  }

  async stop(opts?: { flushAudio?: boolean }) {
    if (this.closed) return;
    this.closed = true;
    this.finalizeBot();
    this.finalizeUser();
    try {
      this.mic?.stop();
    } catch {
      /* ignore */
    }
    this.mic = null;
    try {
      this.session?.close();
    } catch {
      /* ignore */
    }
    this.session = null;
    if (opts?.flushAudio === false) {
      await this.player.close({ flush: false });
    } else {
      await this.player.close();
    }
  }
}
