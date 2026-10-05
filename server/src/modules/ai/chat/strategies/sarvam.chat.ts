import { env } from "../../../../shared/config/env.js";
import { AppError } from "../../../../shared/http/errors.js";
import { logger } from "../../../../shared/logging/logger.js";
import type { ChatCompleteInput, ChatCompleteResult, ChatCompletionPort } from "../chat.types.js";

type SarvamMessage = {
  content?: string | null;
  refusal?: string | null;
  reasoning_content?: string | null;
};

function pickMessageText(message: SarvamMessage | undefined): string | null {
  if (!message) return null;
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content;
  }
  // Reasoning models (e.g. sarvam-105b) often put the answer in reasoning_content
  // when content is null, especially if the output budget is tight.
  if (typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }
  return null;
}

/**
 * Sarvam Chat Completions — requires a platform API key (dashboard),
 * not a Voice Agents sk_samvaad_ key.
 */
export class SarvamChatStrategy implements ChatCompletionPort {
  readonly provider = "sarvam";

  async complete(input: ChatCompleteInput): Promise<ChatCompleteResult> {
    const apiKey = env.SARVAM_CHAT_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(
        503,
        "SCORING_FAILED",
        "SARVAM_CHAT_API_KEY is missing. Voice Agents keys cannot call Chat Completions.",
      );
    }
    if (apiKey.startsWith("sk_samvaad_")) {
      throw new AppError(
        503,
        "SCORING_FAILED",
        "SARVAM_CHAT_API_KEY looks like a Voice Agents key. Use a platform/dashboard API key for chat scoring.",
      );
    }

    const model = env.SARVAM_CHAT_MODEL;
    const maxTokens = input.maxTokens ?? 4096;
    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: input.temperature ?? 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      logger.error("Sarvam chat error", response.status, text.slice(0, 400));
      if (response.status === 401 || response.status === 403) {
        throw new AppError(
          503,
          "SCORING_FAILED",
          "Sarvam Chat rejected the API key. Set SARVAM_CHAT_API_KEY to a valid platform key (not sk_samvaad_).",
        );
      }
      throw new AppError(503, "SCORING_FAILED", "Scoring model request failed");
    }
    try {
      const json = JSON.parse(text) as {
        choices?: { finish_reason?: string; message?: SarvamMessage }[];
      };
      const choice = json.choices?.[0];
      const content = pickMessageText(choice?.message);
      if (!content) {
        logger.error(
          "Sarvam chat empty content",
          choice?.finish_reason,
          text.slice(0, 400),
        );
        throw new Error("empty content");
      }
      if (!choice?.message?.content && choice?.message?.reasoning_content) {
        logger.warn(
          "Sarvam chat used reasoning_content (content was null)",
          choice.finish_reason ?? "",
        );
      }
      return { content, model, provider: this.provider };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(503, "SCORING_FAILED", "Invalid scoring model response");
    }
  }
}
