import "dotenv/config";
import { readFileSync } from "node:fs";

const apiKey = (process.env.SARVAM_CHAT_API_KEY || "").trim();
const model = process.env.SARVAM_CHAT_MODEL || "sarvam-105b";
const system = readFileSync(new URL("../prompts/scoring-system-interviews.md", import.meta.url), "utf8");
const user = `Score this SpeakCoach practice transcript.

Track: interviews
Pass mark: 70.

TRANSCRIPT:
agent: Tell me about yourself.
learner: In my last role I led a cross-functional launch for a payments feature used by about fifty thousand customers. I started by clarifying the success metric with product, then broke the work into weekly milestones. When a dependency slipped, I raised the risk early and proposed a thinner first release so we still hit the date. The outcome was a fourteen percent lift in activation and fewer support tickets in the first month. I would love to hear how your team measures success for similar initiatives.
agent: What would you do differently?
learner: I would involve support earlier so we catch edge cases before launch, and I would keep a clearer rollback plan.`;

const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
  method: "POST",
  headers: {
    "api-subscription-key": apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  }),
});

const text = await response.text();
console.log("status", response.status);
console.log("body_len", text.length);
console.log("body_head", text.slice(0, 1500));
try {
  const json = JSON.parse(text);
  console.log("keys", Object.keys(json));
  console.log("choices0", JSON.stringify(json.choices?.[0], null, 2)?.slice(0, 2000));
  console.log("content_type", typeof json.choices?.[0]?.message?.content);
  console.log("content", json.choices?.[0]?.message?.content);
} catch (e) {
  console.error("json parse failed", e.message);
}
