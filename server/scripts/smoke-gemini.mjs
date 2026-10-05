import { getChatCompletion, resetChatCompletionCache } from "../src/modules/ai/chat/index.js";

resetChatCompletionCache();
const chat = getChatCompletion();
console.log("provider", chat.provider);
try {
  const result = await chat.complete({
    system: 'Return JSON only: {"ok":true}',
    user: "ping",
    temperature: 0,
  });
  console.log("model", result.model);
  console.log("content", result.content.slice(0, 300));
} catch (e) {
  console.error("FAIL", e.message || e);
  process.exit(1);
}
