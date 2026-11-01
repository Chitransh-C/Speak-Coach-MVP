import {
  defaultVoiceForGender,
  normalizeVoiceId,
  VOICES,
  type VoiceGender,
} from "../../../shared/catalog/locale.js";

/** Resolve RoleSmith / Gemini voice id → Live API `voice_name`. */
export function toGeminiVoiceName(RoleSmithVoiceId: string, gender: VoiceGender): string {
  const name = normalizeVoiceId(RoleSmithVoiceId);
  if (VOICES.some((v) => v.id === name)) return name;
  return defaultVoiceForGender(gender);
}
