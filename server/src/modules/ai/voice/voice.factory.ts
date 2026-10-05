import { env } from "../../../shared/config/env.js";
import type { VoiceRuntimePort } from "./voice.types.js";
import { GeminiVoiceStrategy } from "./strategies/gemini.voice.js";
import { SarvamVoiceStrategy } from "./strategies/sarvam.voice.js";

let cached: VoiceRuntimePort | null = null;

/** Strategy factory — switch with VOICE_PROVIDER=sarvam|gemini */
export function getVoiceRuntime(): VoiceRuntimePort {
  if (cached) return cached;
  const runtime: VoiceRuntimePort =
    env.VOICE_PROVIDER === "gemini" ? new GeminiVoiceStrategy() : new SarvamVoiceStrategy();
  cached = runtime;
  return runtime;
}

export function resetVoiceRuntimeCache() {
  cached = null;
}
