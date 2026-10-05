import { env } from "../../../../shared/config/env.js";
import { AppError } from "../../../../shared/http/errors.js";
import { logger } from "../../../../shared/logging/logger.js";
import type { ChatCompleteInput, ChatCompleteResult, ChatCompletionPort } from "../chat.types.js";

const RETRIES = 2;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Google Gemini generateContent as a ChatCompletionPort.
 * Uses structured outputs: responseMimeType=application/json + responseJsonSchema
 * when input.responseSchema is provided.
 * @see https://aistudio.google.com/docs/structured-output
 */
export class GeminiChatStrategy implements ChatCompletionPort {
  readonly provider = "gemini";

  async complete(input: ChatCompleteInput): Promise<ChatCompleteResult> {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new AppError(503, "SCORING_FAILED", "GEMINI_API_KEY is missing");
    }

    const model = env.GEMINI_CHAT_MODEL;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    const generationConfig: Record<string, unknown> = {
      temperature: input.temperature ?? 0.2,
      responseMimeType: "application/json",
      ...(input.maxTokens ? { maxOutputTokens: input.maxTokens } : {}),
    };
    // Prefer JSON Schema field (subset supported by Gemini). Falls back to JSON mode
    // without schema if omitted — docs warn that is only a strong hint.
    if (input.responseSchema) {
      generationConfig.responseJsonSchema = input.responseSchema;
    }

    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.user }] }],
      generationConfig,
    });

    let lastStatus = 0;
    let lastBody = "";
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await response.text();
      lastStatus = response.status;
      lastBody = text;

      if (response.ok) {
        try {
          const json = JSON.parse(text) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const content =
            json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
          if (!content.trim()) throw new Error("empty content");
          return { content, model, provider: this.provider };
        } catch {
          throw new AppError(503, "SCORING_FAILED", "Invalid scoring model response");
        }
      }

      // Some models reject responseJsonSchema — retry once without schema, keep JSON mime.
      if (
        response.status === 400 &&
        input.responseSchema &&
        /responseJsonSchema|response_schema|schema/i.test(text) &&
        attempt === 0
      ) {
        logger.warn("Gemini rejected responseJsonSchema; retrying JSON mode only");
        generationConfig.responseJsonSchema = undefined;
        delete generationConfig.responseJsonSchema;
        const retryBody = JSON.stringify({
          systemInstruction: { parts: [{ text: input.system }] },
          contents: [{ role: "user", parts: [{ text: input.user }] }],
          generationConfig,
        });
        const retryRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: retryBody,
        });
        const retryText = await retryRes.text();
        if (retryRes.ok) {
          const json = JSON.parse(retryText) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const content =
            json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
          if (!content.trim()) throw new AppError(503, "SCORING_FAILED", "Invalid scoring model response");
          return { content, model, provider: this.provider };
        }
        lastStatus = retryRes.status;
        lastBody = retryText;
      }

      const retryable = response.status === 429 || response.status === 503;
      logger.error("Gemini chat error", response.status, text.slice(0, 400));
      if (response.status === 401 || response.status === 403) {
        throw new AppError(503, "SCORING_FAILED", "Gemini rejected GEMINI_API_KEY");
      }
      if (retryable && attempt < RETRIES) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw new AppError(503, "SCORING_FAILED", "Scoring model request failed");
    }

    logger.error("Gemini chat exhausted retries", lastStatus, lastBody.slice(0, 200));
    throw new AppError(503, "SCORING_FAILED", "Scoring model request failed");
  }
}
