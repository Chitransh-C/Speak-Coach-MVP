import { voiceConfig } from "../config/voice.config.js";
import { AppError } from "../../../shared/http/errors.js";
import { logger } from "../../../shared/logging/logger.js";

/** Reverse-proxy helper: forward to Sarvam app-runtime with X-API-Key. */
export const sarvamProxyService = {
  async forward(method: string, pathAndQuery: string, body?: Buffer | string | null) {
    const url = `${voiceConfig.runtimeBase}${pathAndQuery.startsWith("/") ? "" : "/"}${pathAndQuery}`;
    const headers: Record<string, string> = {
      "X-API-Key": voiceConfig.apiKey,
    };
    if (body && method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] = "application/json";
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body && method !== "GET" && method !== "HEAD" ? body : undefined,
      });
    } catch (err) {
      logger.error("Sarvam proxy network error", err);
      throw new AppError(503, "SARVAM_UNAVAILABLE", "Could not reach Sarvam Voice Agents");
    }
    const text = await response.text();
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: text,
    };
  },

  getClientConfig(proxyBaseUrl: string) {
    return {
      orgId: voiceConfig.orgId,
      workspaceId: voiceConfig.workspaceId,
      appId: voiceConfig.appId,
      version: voiceConfig.version,
      proxyBaseUrl,
    };
  },
};
