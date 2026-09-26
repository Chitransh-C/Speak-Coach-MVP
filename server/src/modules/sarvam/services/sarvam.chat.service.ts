import { voiceConfig } from "../config/voice.config.js";
import { AppError } from "../../../shared/http/errors.js";
import { logger } from "../../../shared/logging/logger.js";

export const sarvamChatService = {
  async complete(system: string, user: string): Promise<string> {
    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": voiceConfig.chatKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sarvam-105b",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      logger.error("Sarvam chat error", response.status, text.slice(0, 400));
      throw new AppError(503, "SCORING_FAILED", "Scoring model request failed");
    }
    try {
      const json = JSON.parse(text) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty content");
      return content;
    } catch {
      throw new AppError(503, "SCORING_FAILED", "Invalid scoring model response");
    }
  },
};
