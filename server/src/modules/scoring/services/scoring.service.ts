import { getChatCompletion } from "../../ai/chat/index.js";
import { logger } from "../../../shared/logging/logger.js";
import {
  insufficientSchema,
  scorecardSchema,
  type Scorecard,
} from "../schemas/scorecard.schemas.js";
import { SCORE_RESPONSE_JSON_SCHEMA } from "../schemas/scorecard.json-schema.js";
import { promptsRepository } from "../repositories/prompts.repository.js";
import { scoringRepository } from "../repositories/scoring.repository.js";

type Turn = { speaker: string; text: string; startedAtMs?: number; endedAtMs?: number };

function countLearnerWords(turns: Turn[]) {
  return turns
    .filter((t) => /learner|user/i.test(t.speaker))
    .map((t) => t.text.trim().split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => a + b, 0);
}

function formatTranscript(turns: Turn[]) {
  return turns.map((t) => `${t.speaker}: ${t.text}`).join("\n");
}

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Pull the likeliest JSON object from messy / reasoning model output. */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fences = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) =>
    m[1].trim(),
  );
  for (let i = fences.length - 1; i >= 0; i--) {
    const parsed = tryParseJson(fences[i]);
    if (parsed !== undefined) return parsed;
  }

  if (trimmed.startsWith("{")) {
    const direct = tryParseJson(trimmed);
    if (direct !== undefined) return direct;
  }

  // Prefer an object that looks like a scorecard (has "overall" or "insufficient").
  const marker = /"overall"|"insufficient"/g;
  let match: RegExpExecArray | null;
  const starts: number[] = [];
  while ((match = marker.exec(trimmed))) {
    const brace = trimmed.lastIndexOf("{", match.index);
    if (brace >= 0) starts.push(brace);
  }
  for (let i = starts.length - 1; i >= 0; i--) {
    const start = starts[i];
    let depth = 0;
    for (let j = start; j < trimmed.length; j++) {
      const ch = trimmed[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          const parsed = tryParseJson(trimmed.slice(start, j + 1));
          if (parsed !== undefined) return parsed;
          break;
        }
      }
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const parsed = tryParseJson(trimmed.slice(start, end + 1));
    if (parsed !== undefined) return parsed;
  }
  throw new Error("No valid JSON object in model response");
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

/** Normalize common model drift before Zod. */
function coerceScorecard(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const o = parsed as Record<string, unknown>;
  if (o.insufficient === true) return o;

  const criteriaRaw = Array.isArray(o.criteria) ? o.criteria : [];
  const criteria = criteriaRaw.map((c) => {
    if (!c || typeof c !== "object") return c;
    const row = c as Record<string, unknown>;
    const evidenceRaw = Array.isArray(row.evidence) ? row.evidence : [];
    const evidence = evidenceRaw.map((e) => {
      if (!e || typeof e !== "object") return { quote: "", note: "" };
      const ev = e as Record<string, unknown>;
      return {
        timestampMs:
          ev.timestampMs === null || ev.timestampMs === undefined
            ? null
            : asNumber(ev.timestampMs, 0),
        quote: typeof ev.quote === "string" ? ev.quote : String(ev.quote ?? ""),
        note: typeof ev.note === "string" ? ev.note : String(ev.note ?? ""),
      };
    });
    let weight = asNumber(row.weight);
    if (weight > 0 && weight <= 1) weight = Math.round(weight * 100);
    return {
      ...row,
      weight,
      score: asNumber(row.score),
      evidence,
    };
  });

  const metricsIn =
    o.metrics && typeof o.metrics === "object" && !Array.isArray(o.metrics)
      ? (o.metrics as Record<string, unknown>)
      : {};

  return {
    ...o,
    overall: asNumber(o.overall),
    passed: Boolean(o.passed),
    passMark: asNumber(o.passMark, 70),
    criteria,
    strengths: Array.isArray(o.strengths)
      ? o.strengths.map((s) => String(s))
      : [],
    improvements: Array.isArray(o.improvements)
      ? o.improvements.map((s) => String(s))
      : [],
    coachNotes: typeof o.coachNotes === "string" ? o.coachNotes : String(o.coachNotes ?? ""),
    metrics: {
      talkListenRatio: asNumber(metricsIn.talkListenRatio, 0.5),
      questionsAsked: asNumber(metricsIn.questionsAsked, 0),
      fillerWordCount: asNumber(metricsIn.fillerWordCount, 0),
    },
  };
}

function heuristicScore(turns: Turn[], passMark: number): Scorecard {
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
    passed: overall >= passMark,
    passMark,
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
  async scoreSession(
    sessionId: string,
    turns: Turn[],
    passMark = 70,
    trackId = "interviews",
    scenario?: { id: string; title: string },
  ) {
    const learnerWords = countLearnerWords(turns);
    if (learnerWords < 40) {
      return { insufficient: true as const };
    }

    let system: string;
    let userTpl: string;
    try {
      system = await promptsRepository.getScoringSystem(trackId, scenario?.id);
      userTpl = await promptsRepository.getScoringUserTemplate();
    } catch (err) {
      logger.error(
        "Scoring prompts missing from DB",
        err instanceof Error ? err.message : err,
      );
      const fallback = heuristicScore(turns, passMark);
      await scoringRepository.upsertScore(sessionId, fallback, "heuristic-fallback");
      return { insufficient: false as const, score: fallback, model: "heuristic-fallback" };
    }

    const user = userTpl
      .replace("{{track}}", trackId)
      .replace("{{scenario_id}}", scenario?.id ?? "")
      .replace("{{scenario_title}}", scenario?.title ?? "")
      .replace("{{pass_mark}}", String(passMark))
      .replace("{{transcript}}", formatTranscript(turns));

    let parsed: unknown;
    let model = "unknown";
    let rawContent = "";
    try {
      const result = await getChatCompletion().complete({
        system,
        user,
        temperature: 0.2,
        maxTokens: 8192,
        responseSchema: SCORE_RESPONSE_JSON_SCHEMA as Record<string, unknown>,
      });
      model = `${result.provider}:${result.model}`;
      rawContent = result.content;
      parsed = coerceScorecard(extractJson(result.content));
    } catch (err) {
      logger.error(
        "Scoring chat/parse failed",
        err instanceof Error ? err.message : err,
        rawContent.slice(0, 300),
      );
      const fallback = heuristicScore(turns, passMark);
      await scoringRepository.upsertScore(sessionId, fallback, "heuristic-fallback");
      return { insufficient: false as const, score: fallback, model: "heuristic-fallback" };
    }

    const insuff = insufficientSchema.safeParse(parsed);
    if (insuff.success) {
      return { insufficient: true as const };
    }

    const score = scorecardSchema.safeParse(parsed);
    if (!score.success) {
      logger.error(
        "Scoring schema rejected model JSON",
        score.error.issues.slice(0, 8),
        rawContent.slice(0, 400),
      );
      const fallback = heuristicScore(turns, passMark);
      await scoringRepository.upsertScore(sessionId, fallback, "heuristic-fallback");
      return { insufficient: false as const, score: fallback, model: "heuristic-fallback" };
    }

    const card = score.data;
    card.passed = card.overall >= passMark;
    card.passMark = passMark;
    await scoringRepository.upsertScore(sessionId, card, model);
    return { insufficient: false as const, score: card, model };
  },
};
