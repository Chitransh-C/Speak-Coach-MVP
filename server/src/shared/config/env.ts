import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
// server/.env is the source of truth for the API; root .env is a fallback for Sarvam keys.
loadEnv({ path: resolve(__dirname, "../../../../.env") });
loadEnv({ path: resolve(__dirname, "../../../.env"), override: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  SARVAM_API_KEY: z.string().min(1),
  SARVAM_ORG_ID: z.string().min(1),
  SARVAM_WORKSPACE_ID: z.string().min(1),
  SARVAM_APP_ID: z.string().min(1),
  SARVAM_AGENT_VERSION: z.coerce.number().default(1),
  SARVAM_CHAT_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
