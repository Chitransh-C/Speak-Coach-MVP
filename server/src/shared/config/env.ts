import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/.env is the source of truth for the API; root .env is a fallback.
loadEnv({ path: resolve(__dirname, "../../../../.env") });
loadEnv({ path: resolve(__dirname, "../../../.env"), override: true });

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(8),
    PORT: z.coerce.number().default(3001),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),

    /** Chat scoring provider: sarvam | gemini */
    CHAT_PROVIDER: z.enum(["sarvam", "gemini"]).default("sarvam"),
    /** Live voice provider: sarvam | gemini */
    VOICE_PROVIDER: z.enum(["sarvam", "gemini"]).default("sarvam"),

    /** Voice Agents key (sk_samvaad_…). Prefer SARVAM_VOICE_API_KEY. */
    SARVAM_VOICE_API_KEY: z.string().optional(),
    /** @deprecated use SARVAM_VOICE_API_KEY */
    SARVAM_API_KEY: z.string().optional(),
    /** Platform / dashboard key for Sarvam Chat Completions (not sk_samvaad_). */
    SARVAM_CHAT_API_KEY: z.string().optional(),
    SARVAM_CHAT_MODEL: z.string().default("sarvam-105b"),

    GEMINI_API_KEY: z.string().optional(),
    GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash"),
    GEMINI_VOICE_MODEL: z.string().default("gemini-2.5-flash-native-audio-preview-12-2025"),
  })
  .superRefine((val, ctx) => {
    const voiceKey = val.SARVAM_VOICE_API_KEY || val.SARVAM_API_KEY;
    if (val.VOICE_PROVIDER === "sarvam" && !voiceKey) {
      ctx.addIssue({
        code: "custom",
        message: "SARVAM_VOICE_API_KEY (or SARVAM_API_KEY) is required when VOICE_PROVIDER=sarvam",
        path: ["SARVAM_VOICE_API_KEY"],
      });
    }
    if (val.CHAT_PROVIDER === "sarvam" && !val.SARVAM_CHAT_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message:
          "SARVAM_CHAT_API_KEY is required when CHAT_PROVIDER=sarvam (Voice Agents sk_samvaad_ keys cannot call Chat Completions)",
        path: ["SARVAM_CHAT_API_KEY"],
      });
    }
    if (val.CHAT_PROVIDER === "gemini" && !val.GEMINI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "GEMINI_API_KEY is required when CHAT_PROVIDER=gemini",
        path: ["GEMINI_API_KEY"],
      });
    }
    if (val.VOICE_PROVIDER === "gemini" && !val.GEMINI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "GEMINI_API_KEY is required when VOICE_PROVIDER=gemini",
        path: ["GEMINI_API_KEY"],
      });
    }
  });

const parsed = envSchema.parse(process.env);

/** Comma-separated CORS_ORIGIN → list (for Fastify cors origin callback). */
export function corsOrigins(): string[] {
  return parsed.CORS_ORIGIN.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type Env = z.infer<typeof envSchema> & {
  /** Resolved Voice Agents API key */
  sarvamVoiceApiKey: string;
};

export const env: Env = {
  ...parsed,
  sarvamVoiceApiKey: (parsed.SARVAM_VOICE_API_KEY || parsed.SARVAM_API_KEY || "").trim(),
};
