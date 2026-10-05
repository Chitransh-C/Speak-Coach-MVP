import { env } from "../../../shared/config/env.js";

/** Shared Sarvam Voice Agents secrets — per-scenario agent ids come from DB. */
export const voiceConfig = {
  apiKey: env.sarvamVoiceApiKey,
  runtimeBase: "https://apps.sarvam.ai/api/app-runtime",
};

export type ScenarioAgentConfig = {
  orgId: string;
  workspaceId: string;
  appId: string;
  version: number;
};
