/** Central SpeakCoach language + voice catalogs (not per-scenario). */

export type VoiceGender = "male" | "female";

export type LanguageEntry = {
  code: string;
  label: string;
  /** Sarvam SDK / agent LanguageName */
  sarvamName: string;
};

export type VoiceEntry = {
  id: string;
  label: string;
  gender: VoiceGender;
};

export const LANGUAGES: LanguageEntry[] = [
  { code: "en-IN", label: "English", sarvamName: "English" },
  { code: "hi-IN", label: "Hindi", sarvamName: "Hindi" },
  { code: "bn-IN", label: "Bengali", sarvamName: "Bengali" },
  { code: "ta-IN", label: "Tamil", sarvamName: "Tamil" },
  { code: "te-IN", label: "Telugu", sarvamName: "Telugu" },
  { code: "mr-IN", label: "Marathi", sarvamName: "Marathi" },
  { code: "gu-IN", label: "Gujarati", sarvamName: "Gujarati" },
  { code: "kn-IN", label: "Kannada", sarvamName: "Kannada" },
  { code: "ml-IN", label: "Malayalam", sarvamName: "Malayalam" },
  { code: "pa-IN", label: "Punjabi", sarvamName: "Punjabi" },
];

/** Curated subset of workspace synthesizable voices (list_voices). */
export const VOICES: VoiceEntry[] = [
  { id: "shubh", label: "Shubh", gender: "male" },
  { id: "aditya", label: "Aditya", gender: "male" },
  { id: "rahul", label: "Rahul", gender: "male" },
  { id: "rohan", label: "Rohan", gender: "male" },
  { id: "amit", label: "Amit", gender: "male" },
  { id: "kabir", label: "Kabir", gender: "male" },
  { id: "priya", label: "Priya", gender: "female" },
  { id: "ritu", label: "Ritu", gender: "female" },
  { id: "simran", label: "Simran", gender: "female" },
  { id: "amelia", label: "Amelia", gender: "female" },
  { id: "sophia", label: "Sophia", gender: "female" },
  { id: "ishita", label: "Ishita", gender: "female" },
];

const DEFAULT_VOICE: Record<VoiceGender, string> = {
  male: "shubh",
  female: "priya",
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
  return listVoices(gender).some((v) => v.id === id);
}

export function toSarvamLanguageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.sarvamName ?? "English";
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
