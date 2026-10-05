import { getChatCompletion, resetChatCompletionCache } from "../src/modules/ai/chat/index.js";

resetChatCompletionCache();
const chat = getChatCompletion();
console.log("provider", chat.provider);
const result = await chat.complete({
  system: 'Return JSON only: {"ok":true}',
  user: "ping",
  temperature: 0,
});
console.log("model", result.model);
console.log("content", result.content.slice(0, 200));
