import { readFileSync } from "node:fs";
import { getChatCompletion, resetChatCompletionCache } from "../src/modules/ai/chat/index.js";
import {
  insufficientSchema,
  scorecardSchema,
} from "../src/modules/scoring/schemas/scorecard.schemas.js";

resetChatCompletionCache();
const system = readFileSync(new URL("../prompts/scoring-system-interviews.md", import.meta.url), "utf8");
const user = `Track: interviews
Pass mark: 70.

TRANSCRIPT:
agent: Tell me about yourself.
learner: In my last role I led a cross-functional launch for a payments feature used by about fifty thousand customers. I started by clarifying the success metric with product, then broke the work into weekly milestones. When a dependency slipped, I raised the risk early and proposed a thinner first release so we still hit the date. The outcome was a fourteen percent lift in activation and fewer support tickets in the first month. I would love to hear how your team measures success for similar initiatives.
agent: What would you do differently?
learner: I would involve support earlier so we catch edge cases before launch, and I would keep a clearer rollback plan.

Respond with the JSON object only. Begin with {.`;

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function extractJson(raw) {
  const trimmed = raw.trim();
  const fences = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1].trim());
  for (let i = fences.length - 1; i >= 0; i--) {
    const parsed = tryParseJson(fences[i]);
    if (parsed !== undefined) return parsed;
  }
  const marker = /"overall"|"insufficient"/g;
  let match;
  const starts = [];
  while ((match = marker.exec(trimmed))) {
    const brace = trimmed.lastIndexOf("{", match.index);
    if (brace >= 0) starts.push(brace);
  }
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i];
    let depth = 0;
    for (let j = start; j < trimmed.length; j++) {
      if (trimmed[j] === "{") depth++;
      else if (trimmed[j] === "}") {
        depth--;
        if (depth === 0) {
          const parsed = tryParseJson(trimmed.slice(start, j + 1));
          if (parsed !== undefined) return parsed;
          break;
        }
      }
    }
  }
  throw new Error("No valid JSON object in model response");
}

const result = await getChatCompletion().complete({
  system,
  user,
  temperature: 0.2,
  maxTokens: 8192,
});
console.log("provider", result.provider, "model", result.model);
console.log("RAW_LEN", result.content.length);
console.log("RAW_TAIL", result.content.slice(-800));

try {
  const parsed = extractJson(result.content);
  console.log("parsed keys", Object.keys(parsed));
  const insuff = insufficientSchema.safeParse(parsed);
  console.log("insufficient", insuff.success);
  const score = scorecardSchema.safeParse(parsed);
  console.log("score ok", score.success, score.success ? score.data.overall : "");
  if (!score.success) console.log(JSON.stringify(score.error.issues, null, 2));
} catch (e) {
  console.error("parse error", e.message);
  process.exit(1);
}
