/** RoleSmith language + voice catalogs (Gemini Live). */

export type VoiceGender = "male" | "female";

export type LanguageEntry = {
  /** BCP-47 code passed to Gemini Live speechConfig.languageCode */
  code: string;
  label: string;
};

export type VoiceEntry = {
  /** Gemini Live prebuilt voice_name */
  id: string;
  label: string;
  gender: VoiceGender;
  /** Short tone hint from Gemini voice docs */
  tone: string;
};

/**
 * Gemini Live–supported languages (≥20). India-focused core + global majors.
 * @see https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice
 */
export const LANGUAGES: LanguageEntry[] = [
  { code: "en-IN", label: "English (India)" },
  { code: "en-US", label: "English (US)" },
  { code: "hi-IN", label: "Hindi" },
  { code: "bn-IN", label: "Bengali (India)" },
  { code: "bn-BD", label: "Bengali (Bangladesh)" },
  { code: "ta-IN", label: "Tamil" },
  { code: "te-IN", label: "Telugu" },
  { code: "mr-IN", label: "Marathi" },
  { code: "gu-IN", label: "Gujarati" },
  { code: "kn-IN", label: "Kannada" },
  { code: "ml-IN", label: "Malayalam" },
  { code: "pa-IN", label: "Punjabi" },
  { code: "ur-IN", label: "Urdu" },
  { code: "es-ES", label: "Spanish (Spain)" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ar-EG", label: "Arabic (Egypt)" },
  { code: "id-ID", label: "Indonesian" },
  { code: "th-TH", label: "Thai" },
  { code: "vi-VN", label: "Vietnamese" },
];

/**
 * Curated Gemini prebuilt voices — 10 male + 10 female.
 * Gender filters so learners match the scenario character.
 */
export const VOICES: VoiceEntry[] = [
  // Male (10)
  { id: "Charon", label: "Charon", gender: "male", tone: "Informative — deep, calm and clear" },
  { id: "Orus", label: "Orus", gender: "male", tone: "Firm — mature and reassuring" },
  { id: "Puck", label: "Puck", gender: "male", tone: "Upbeat — bright and approachable" },
  { id: "Fenrir", label: "Fenrir", gender: "male", tone: "Excitable — animated and energetic" },
  { id: "Iapetus", label: "Iapetus", gender: "male", tone: "Clear — crisp and precise" },
  { id: "Umbriel", label: "Umbriel", gender: "male", tone: "Easy-going — relaxed and casual" },
  { id: "Algenib", label: "Algenib", gender: "male", tone: "Gravelly — textured and grounded" },
  { id: "Alnilam", label: "Alnilam", gender: "male", tone: "Firm — confident and direct" },
  { id: "Schedar", label: "Schedar", gender: "male", tone: "Even — balanced and neutral" },
  { id: "Sadaltager", label: "Sadaltager", gender: "male", tone: "Knowledgeable — assured and steady" },
  // Female (10)
  { id: "Kore", label: "Kore", gender: "female", tone: "Firm — steady and confident" },
  { id: "Aoede", label: "Aoede", gender: "female", tone: "Breezy — easy, friendly energy" },
  { id: "Leda", label: "Leda", gender: "female", tone: "Youthful — gentle and approachable" },
  { id: "Zephyr", label: "Zephyr", gender: "female", tone: "Bright — clean and articulate" },
  { id: "Autonoe", label: "Autonoe", gender: "female", tone: "Bright — crisp and cheerful" },
  { id: "Despina", label: "Despina", gender: "female", tone: "Smooth — polished and calm" },
  { id: "Erinome", label: "Erinome", gender: "female", tone: "Clear — precise and articulate" },
  { id: "Laomedeia", label: "Laomedeia", gender: "female", tone: "Upbeat — bright and lively" },
  { id: "Achernar", label: "Achernar", gender: "female", tone: "Soft — gentle and soothing" },
  { id: "Sulafat", label: "Sulafat", gender: "female", tone: "Warm — friendly and inviting" },
];

/** Legacy RoleSmith / Sarvam voice ids → Gemini prebuilt names */
const LEGACY_VOICE_MAP: Record<string, string> = {
  shubh: "Charon",
  aditya: "Puck",
  rahul: "Fenrir",
  rohan: "Orus",
  amit: "Iapetus",
  kabir: "Algenib",
  priya: "Kore",
  ritu: "Aoede",
  simran: "Leda",
  amelia: "Zephyr",
  sophia: "Autonoe",
  ishita: "Despina",
  // Dropped curated voices → nearest still in catalog
  rasalgethi: "Charon",
  zubenelgenubi: "Umbriel",
  gacrux: "Kore",
  vindemiatrix: "Achernar",
};

const DEFAULT_VOICE: Record<VoiceGender, string> = {
  male: "Charon",
  female: "Kore",
};

export function listLanguages(): LanguageEntry[] {
  return LANGUAGES;
}

export function listVoices(gender?: VoiceGender): VoiceEntry[] {
  if (!gender) return VOICES;
  return VOICES.filter((v) => v.gender === gender);
}

export function isLanguageCode(code: string): boolean {
  return LANGUAGES.some((l) => l.code === code);
}

export function isVoiceId(id: string, gender?: VoiceGender): boolean {
  const normalized = normalizeVoiceId(id);
  return listVoices(gender).some((v) => v.id === normalized);
}

export function normalizeVoiceId(id: string): string {
  if (VOICES.some((v) => v.id === id)) return id;
  const mapped = LEGACY_VOICE_MAP[id] ?? LEGACY_VOICE_MAP[id.toLowerCase()];
  if (mapped && VOICES.some((v) => v.id === mapped)) return mapped;
  return id;
}

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export function defaultVoiceForGender(gender: VoiceGender): string {
  return DEFAULT_VOICE[gender];
}

export function normalizeGender(value: unknown): VoiceGender {
  return value === "female" ? "female" : "male";
}

export function localesPayload() {
  return {
    languages: listLanguages(),
    voices: listVoices(),
  };
}
