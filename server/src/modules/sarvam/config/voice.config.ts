import { env } from "../../../shared/config/env.js";

export const voiceConfig = {
  orgId: env.SARVAM_ORG_ID,
  workspaceId: env.SARVAM_WORKSPACE_ID,
  appId: env.SARVAM_APP_ID,
  version: env.SARVAM_AGENT_VERSION,
  apiKey: env.SARVAM_API_KEY,
  runtimeBase: "https://apps.sarvam.ai/api/app-runtime",
  chatKey: env.SARVAM_CHAT_API_KEY || env.SARVAM_API_KEY,
};
