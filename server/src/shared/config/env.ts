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
    CHAT_PROVIDER: z.enum(["sarvam", "gemini"]).default("gemini"),

    /** Optional — only when CHAT_PROVIDER=sarvam */
    SARVAM_CHAT_API_KEY: z.string().optional(),
    SARVAM_CHAT_MODEL: z.string().default("sarvam-105b"),

    /** Required for Live practice (Gemini Live + ephemeral tokens) */
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_CHAT_MODEL: z.string().default("gemini-2.5-flash"),
    GEMINI_VOICE_MODEL: z.string().default("gemini-3.8-live"),
    /** Short voice samples on Setup (TTS generateContent). */
    GEMINI_TTS_MODEL: z.string().default("gemini-2.5-flash-preview-tts"),
    /** Hard cap for any practice Live call (minutes). */
    GEMINI_LIVE_MAX_CALL_MINUTES: z.coerce.number().min(3).max(25).default(25),

    /** Seeded platform admin (prisma seed) */
    ADMIN_EMAIL: z.string().email().default("admin@rolesmith.local"),
    ADMIN_PASSWORD: z.string().min(8).default("RoleSmithAdmin1!"),
    ADMIN_DISPLAY_NAME: z.string().min(1).default("RoleSmith Admin"),
  })
  .superRefine((val, ctx) => {
    if (val.CHAT_PROVIDER === "sarvam" && !val.SARVAM_CHAT_API_KEY) {
      ctx.addIssue({
        code: "custom",
        message: "SARVAM_CHAT_API_KEY is required when CHAT_PROVIDER=sarvam",
        path: ["SARVAM_CHAT_API_KEY"],
      });
    }
    if (!val.GEMINI_API_KEY?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "GEMINI_API_KEY is required for Gemini Live practice",
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

export type Env = z.infer<typeof envSchema>;

export const env: Env = parsed;
