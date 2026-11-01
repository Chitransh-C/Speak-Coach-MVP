import { env } from "../../../shared/config/env.js";
import { AppError } from "../../../shared/http/errors.js";
import { logger } from "../../../shared/logging/logger.js";
import { toGeminiVoiceName } from "./gemini.voice-map.js";
import { buildGeminiLiveSystemInstruction } from "./gemini.system-prompt.js";

export type MintEphemeralInput = {
  languageCode: string;
  languageLabel: string;
  voiceId: string;
  gender: "male" | "female";
  participantName: string;
  agentVariables: Record<string, string>;
  /** Scenario practice call length in minutes (from Scenario.practiceCallMin). */
  callDurationMin: number;
};

export type MintEphemeralResult = {
  token: string;
  model: string;
  voiceName: string;
  languageCode: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  callDurationMin: number;
  systemInstruction: string;
};

const END_CALL_TOOL = {
  functionDeclarations: [
    {
      name: "end_call",
      description:
        "End the live practice call after a spoken closing line. Use when the learner says goodbye, is non-cooperative/gibberish, practice is impossible, or ~10+ turns and the agenda is clearly complete.",
      parameters: {
        type: "OBJECT",
        properties: {
          reason: {
            type: "STRING",
            description:
              "Short reason such as learner_goodbye, gibberish, waste_of_time, non_cooperative, off_scenario( framed into a sentence based on your persona)",
          },
        },
        required: ["reason"],
      },
    },
  ],
};

function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/** Clamp scenario length into [3, GEMINI_LIVE_MAX_CALL_MINUTES]. */
export function clampCallDurationMin(requested: number): number {
  const max = env.GEMINI_LIVE_MAX_CALL_MINUTES;
  const n = Number.isFinite(requested) ? Math.round(requested) : 5;
  return Math.min(max, Math.max(3, n));
}

/**
 * Mint ONE ephemeral Live token for the whole practice call.
 * Lifetime = scenario practiceCallMin (+ small buffer), capped at 25.
 * We do not renew tokens mid-call — fixed call timing ends the session in the app.
 * `sessionResumption` only lets Google reattach the same WS after a ~10m server reset;
 * that is not a call extension / renew flow.
 */
export async function mintGeminiEphemeralToken(
  input: MintEphemeralInput,
): Promise<MintEphemeralResult> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "VOICE_UNAVAILABLE", "GEMINI_API_KEY is missing");
  }

  const callDurationMin = clampCallDurationMin(input.callDurationMin);
  // +2 min buffer so wrap-up / end_call still fits before Google rejects messages.
  const sessionExpireMin = Math.min(env.GEMINI_LIVE_MAX_CALL_MINUTES + 2, callDurationMin + 2);
  // Reconnect window covers the whole call (WS resets ~10m need resume).
  const connectExpireMin = Math.min(env.GEMINI_LIVE_MAX_CALL_MINUTES + 2, callDurationMin + 5);

  const model = env.GEMINI_VOICE_MODEL;
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const voiceName = toGeminiVoiceName(input.voiceId, input.gender);
  const systemInstruction = buildGeminiLiveSystemInstruction({
    languageCode: input.languageCode,
    languageLabel: input.languageLabel,
    participantName: input.participantName,
    agentVariables: input.agentVariables,
    statedCallMin: callDurationMin,
  });

  const expireTime = isoMinutesFromNow(sessionExpireMin);
  const newSessionExpireTime = isoMinutesFromNow(connectExpireMin);

  const body = {
    uses: 1,
    expireTime,
    newSessionExpireTime,
    bidiGenerateContentSetup: {
      model: modelPath,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          // https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice
          languageCode: input.languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      tools: [END_CALL_TOOL],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      sessionResumption: {},
      contextWindowCompression: { slidingWindow: {} },
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/auth_tokens?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();

  if (!response.ok) {
    logger.error("Gemini ephemeral token mint failed", {
      status: response.status,
      body: text.slice(0, 500),
    });
    if (response.status === 401 || response.status === 403) {
      throw new AppError(503, "VOICE_UNAVAILABLE", "Gemini rejected GEMINI_API_KEY");
    }
    throw new AppError(
      503,
      "VOICE_UNAVAILABLE",
      "Could not mint Gemini Live ephemeral token",
    );
  }

  let json: { name?: string };
  try {
    json = JSON.parse(text) as { name?: string };
  } catch {
    throw new AppError(503, "VOICE_UNAVAILABLE", "Invalid Gemini token response");
  }

  const token = json.name?.trim();
  if (!token) {
    throw new AppError(503, "VOICE_UNAVAILABLE", "Gemini token response missing name");
  }

  return {
    token,
    model,
    voiceName,
    languageCode: input.languageCode,
    expiresAt: expireTime,
    newSessionExpiresAt: newSessionExpireTime,
    callDurationMin,
    systemInstruction,
  };
}
