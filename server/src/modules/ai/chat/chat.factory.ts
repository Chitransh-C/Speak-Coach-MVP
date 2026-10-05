import { env } from "../../../shared/config/env.js";
import type { ChatCompletionPort } from "./chat.types.js";
import { GeminiChatStrategy } from "./strategies/gemini.chat.js";
import { SarvamChatStrategy } from "./strategies/sarvam.chat.js";

let cached: ChatCompletionPort | null = null;

/** Strategy factory — switch with CHAT_PROVIDER=sarvam|gemini */
export function getChatCompletion(): ChatCompletionPort {
  if (cached) return cached;
  cached = env.CHAT_PROVIDER === "gemini" ? new GeminiChatStrategy() : new SarvamChatStrategy();
  return cached;
}

/** Test helper */
export function resetChatCompletionCache() {
  cached = null;
}
