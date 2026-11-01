import { env } from "../../../shared/config/env.js";
import { AppError } from "../../../shared/http/errors.js";
import { logger } from "../../../shared/logging/logger.js";
import { toGeminiVoiceName } from "./gemini.voice-map.js";
import {
  LUMI_ASSISTANT_CALL_MIN,
  LUMI_ASSISTANT_TOOLS,
  buildLumiAssistantSystemInstruction,
} from "./gemini.assistant-prompt.js";

export type MintAssistantResult = {
  token: string;
  model: string;
  voiceName: string;
  languageCode: string;
  expiresAt: string;
  newSessionExpiresAt: string;
  callDurationMin: number;
  systemInstruction: string;
};

function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

/**
 * Mint a short-lived Gemini Live token for Lumi (help assistant).
 * Fixed ~2 minute session; tools are help actions (not role-play).
 */
export async function mintLumiAssistantToken(input?: {
  languageCode?: string;
  voiceId?: string;
}): Promise<MintAssistantResult> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "VOICE_UNAVAILABLE", "GEMINI_API_KEY is missing");
  }

  const callDurationMin = LUMI_ASSISTANT_CALL_MIN;
  const sessionExpireMin = callDurationMin + 2;
  const connectExpireMin = callDurationMin + 3;

  const languageCode = input?.languageCode?.trim() || "en-IN";
  const voiceId = input?.voiceId?.trim() || "Aoede";
  const voiceName = toGeminiVoiceName(voiceId, "female");
  const model = env.GEMINI_VOICE_MODEL;
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const systemInstruction = buildLumiAssistantSystemInstruction();

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
          languageCode,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      tools: [LUMI_ASSISTANT_TOOLS],
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
    logger.error("Lumi assistant token mint failed", {
      status: response.status,
      body: text.slice(0, 500),
    });
    if (response.status === 401 || response.status === 403) {
      throw new AppError(503, "VOICE_UNAVAILABLE", "Gemini rejected GEMINI_API_KEY");
    }
    throw new AppError(
      503,
      "VOICE_UNAVAILABLE",
      "Could not mint Lumi assistant Live token",
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
    languageCode,
    expiresAt: expireTime,
    newSessionExpiresAt: newSessionExpireTime,
    callDurationMin,
    systemInstruction,
  };
}
