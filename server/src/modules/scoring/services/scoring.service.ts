import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sarvamChatService } from "../../sarvam/services/sarvam.chat.service.js";
import {
  insufficientSchema,
  scorecardSchema,
  type Scorecard,
} from "../schemas/scorecard.schemas.js";
import { scoringRepository } from "../repositories/scoring.repository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Turn = { speaker: string; text: string; startedAtMs?: number; endedAtMs?: number };

function loadPrompt(name: string) {
  return readFileSync(resolve(__dirname, `../../../../prompts/${name}`), "utf8");
}

function countLearnerWords(turns: Turn[]) {
  return turns
    .filter((t) => /learner|user/i.test(t.speaker))
    .map((t) => t.text.trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
}

function formatTranscript(turns: Turn[]) {
  return turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fence ? fence[1].trim() : trimmed;
  return JSON.parse(text);
}

function heuristicScore(turns: Turn[]): Scorecard {
  const learnerWords = countLearnerWords(turns);
  const learnerText = turns
    .filter((t) => /learner|user/i.test(t.speaker))
    .map((t) => t.text)
    .join(" ");
  const questionsAsked = (learnerText.match(/\?/g) || []).length;
  const fillers = (learnerText.match(/\b(um|uh|like|you know)\b/gi) || []).length;
  const base = Math.min(88, 55 + Math.floor(learnerWords / 8));
  const criteria = [
    { id: "C1", name: "Curiosity & Close", weight: 20, score: base - 5, evidence: [] },
    { id: "C2", name: "Structure & Clarity", weight: 25, score: base, evidence: [] },
    { id: "C3", name: "Listening & Fit", weight: 20, score: base - 2, evidence: [] },
    { id: "C4", name: "Composure Under Pressure", weight: 15, score: base - 4, evidence: [] },
    { id: "C5", name: "Evidence & Specifics", weight: 20, score: base - 8, evidence: [] },
  ];
  const overall = Math.round(
    criteria.reduce((sum, c) => sum + c.score * (c.weight / 100), 0),
  );
  return {
    overall,
    passed: overall >= 70,
    passMark: 70,
    criteria,
    strengths: ["You completed a full practice exchange and stayed engaged."],
    improvements: ["Add one concrete metric or example in your next attempt."],
    coachNotes:
      "Heuristic score used because the chat scoring API was unavailable. Treat as directional feedback.",
    metrics: {
      talkListenRatio: 0.6,
      questionsAsked,
      fillerWordCount: fillers,
    },
  };
}

export const scoringService = {
  async scoreSession(sessionId: string, turns: Turn[]) {
    const learnerWords = countLearnerWords(turns);
    if (learnerWords < 40) {
      return { insufficient: true as const };
    }

    const system = loadPrompt("scoring-system.md");
    const userTpl = loadPrompt("scoring-user-template.md");
    const user = userTpl.replace("{{transcript}}", formatTranscript(turns));

    let parsed: unknown;
    let model = "sarvam-105b";
    try {
      const raw = await sarvamChatService.complete(system, user);
      parsed = extractJson(raw);
    } catch {
      const fallback = heuristicScore(turns);
      await scoringRepository.upsertScore(sessionId, fallback, "heuristic-fallback");
      return { insufficient: false as const, score: fallback, model: "heuristic-fallback" };
    }

    const insuff = insufficientSchema.safeParse(parsed);
    if (insuff.success) {
      return { insufficient: true as const };
    }

    let score = scorecardSchema.safeParse(parsed);
    if (!score.success) {
      // one retry already fails → heuristic
      const fallback = heuristicScore(turns);
      await scoringRepository.upsertScore(sessionId, fallback, "heuristic-fallback");
      return { insufficient: false as const, score: fallback, model: "heuristic-fallback" };
    }

    const card = score.data;
    card.passed = card.overall >= 70;
    card.passMark = 70;
    await scoringRepository.upsertScore(sessionId, card, model);
    return { insufficient: false as const, score: card, model };
  },
};
