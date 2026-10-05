/**
 * JSON Schema for Gemini structured outputs (responseJsonSchema).
 * Matches SpeakCoach scorecard + insufficient short-circuit.
 * @see https://aistudio.google.com/docs/structured-output
 */

const evidenceItem = {
  type: "object",
  properties: {
    timestampMs: {
      type: ["number", "null"],
      description: "Optional timestamp in ms if known; otherwise null",
    },
    quote: { type: "string", description: "Short quote from the learner transcript" },
    note: { type: "string", description: "Why this evidence supports the criterion score" },
  },
  required: ["quote", "note"],
} as const;

const criterionItem = {
  type: "object",
  properties: {
    id: {
      type: "string",
      enum: ["C1", "C2", "C3", "C4", "C5"],
      description: "Criterion id",
    },
    name: { type: "string", description: "Criterion display name" },
    weight: {
      type: "number",
      description: "Weight as percentage of 100 (e.g. 20, not 0.2)",
      minimum: 0,
      maximum: 100,
    },
    score: {
      type: "number",
      description: "Criterion score 0-100",
      minimum: 0,
      maximum: 100,
    },
    evidence: {
      type: "array",
      items: evidenceItem,
      description: "Evidence quotes supporting the score",
    },
  },
  required: ["id", "name", "weight", "score", "evidence"],
} as const;

const scorecardObject = {
  type: "object",
  title: "Scorecard",
  description: "Full practice scorecard when learner speech is sufficient",
  properties: {
    overall: {
      type: "number",
      description: "Weighted overall score 0-100",
      minimum: 0,
      maximum: 100,
    },
    passed: { type: "boolean", description: "True when overall >= passMark" },
    passMark: { type: "number", description: "Pass threshold", minimum: 0, maximum: 100 },
    criteria: {
      type: "array",
      items: criterionItem,
      minItems: 5,
      maxItems: 5,
      description: "Exactly five rubric criteria C1-C5",
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "2-4 strengths tied to observed behavior",
    },
    improvements: {
      type: "array",
      items: { type: "string" },
      description: "2-4 actionable coaching improvements",
    },
    coachNotes: {
      type: "string",
      description: "2-4 sentence constructive summary",
    },
    metrics: {
      type: "object",
      properties: {
        talkListenRatio: {
          type: "number",
          description: "Approx learner_words / max(agent_words, 1)",
        },
        questionsAsked: {
          type: "number",
          description: "Count of learner questions",
        },
        fillerWordCount: {
          type: "number",
          description: "Approx filler word count (um/uh/like/you know)",
        },
      },
      required: ["talkListenRatio", "questionsAsked", "fillerWordCount"],
    },
  },
  required: [
    "overall",
    "passed",
    "passMark",
    "criteria",
    "strengths",
    "improvements",
    "coachNotes",
    "metrics",
  ],
} as const;

const insufficientObject = {
  type: "object",
  title: "InsufficientTranscript",
  description: "Return this when learner speech is under ~40 words",
  properties: {
    insufficient: {
      type: "boolean",
      enum: [true],
      description: "Must be true",
    },
  },
  required: ["insufficient"],
} as const;

/** Root schema: scorecard OR insufficient (anyOf), as in Gemini structured-output docs. */
export const SCORE_RESPONSE_JSON_SCHEMA = {
  anyOf: [scorecardObject, insufficientObject],
} as const;
