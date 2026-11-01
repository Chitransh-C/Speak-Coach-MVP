import type { VoiceRuntimePort } from "./voice.types.js";
import { GeminiVoiceStrategy } from "./strategies/gemini.voice.js";

let cached: VoiceRuntimePort | null = null;

/** Live practice uses Gemini Live only (ephemeral tokens + browser WS). */
export function getVoiceRuntime(): VoiceRuntimePort {
  if (cached) return cached;
  cached = new GeminiVoiceStrategy();
  return cached;
}

export function resetVoiceRuntimeCache() {
  cached = null;
}
