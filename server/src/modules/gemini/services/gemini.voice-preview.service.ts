import { env } from "../../../shared/config/env.js";
import { AppError } from "../../../shared/http/errors.js";
import { logger } from "../../../shared/logging/logger.js";
import {
  VOICES,
  isLanguageCode,
  isVoiceId,
  normalizeVoiceId,
} from "../../../shared/catalog/locale.js";
import { toGeminiVoiceName } from "./gemini.voice-map.js";

export type VoicePreviewInput = {
  voiceId: string;
  languageCode?: string;
  text?: string;
};

export type VoicePreviewResult = {
  audioBase64: string;
  mimeType: string;
  voiceId: string;
  languageCode: string;
};

const DEFAULT_SAMPLE = "Hi, I'm ready to practice with you.";

/** Wrap raw 16-bit PCM as a tiny WAV so browsers can play it via Audio(). */
function pcmToWavBase64(pcmBase64: string, sampleRate = 24_000): string {
  const pcm = Buffer.from(pcmBase64, "base64");
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);
  return buffer.toString("base64");
}

/**
 * Short TTS sample for Setup voice cards (Gemini TTS generateContent).
 */
export async function previewGeminiVoice(
  input: VoicePreviewInput,
): Promise<VoicePreviewResult> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(503, "VOICE_UNAVAILABLE", "GEMINI_API_KEY is missing");
  }

  const voiceId = normalizeVoiceId(input.voiceId);
  if (!isVoiceId(voiceId)) {
    throw new AppError(400, "VALIDATION_ERROR", `Unknown voiceId: ${input.voiceId}`);
  }

  const languageCode =
    input.languageCode && isLanguageCode(input.languageCode)
      ? input.languageCode
      : "en-IN";

  const text = (input.text?.trim() || DEFAULT_SAMPLE).slice(0, 160);
  const gender = VOICES.find((v) => v.id === voiceId)?.gender ?? "male";
  const voiceName = toGeminiVoiceName(voiceId, gender);
  const model = env.GEMINI_TTS_MODEL;
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent`;
  const body = {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();

  if (!response.ok) {
    logger.error("Gemini voice preview failed", {
      status: response.status,
      body: raw.slice(0, 500),
      voiceName,
      model,
    });
    throw new AppError(503, "VOICE_UNAVAILABLE", "Could not generate voice preview");
  }

  let json: {
    candidates?: {
      content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
    }[];
  };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    throw new AppError(503, "VOICE_UNAVAILABLE", "Invalid voice preview response");
  }

  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
    ?.inlineData;
  if (!inline?.data) {
    throw new AppError(503, "VOICE_UNAVAILABLE", "Voice preview missing audio");
  }

  const mime = (inline.mimeType || "").toLowerCase();
  const alreadyContainer =
    mime.includes("wav") || mime.includes("mpeg") || mime.includes("mp3") || mime.includes("ogg");
  // TTS often returns raw PCM; wrap as WAV for <audio> / Audio()
  if (!alreadyContainer || mime.includes("pcm") || mime.includes("l16")) {
    return {
      audioBase64: pcmToWavBase64(inline.data),
      mimeType: "audio/wav",
      voiceId,
      languageCode,
    };
  }

  return {
    audioBase64: inline.data,
    mimeType: inline.mimeType || "audio/wav",
    voiceId,
    languageCode,
  };
}
