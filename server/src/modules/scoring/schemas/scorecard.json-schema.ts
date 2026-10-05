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
    feedback: {
      type: "string",
      description:
        "40-60 words: why this criterion scored as it did; include [mm:ss] and a short quote",
    },
    evidence: {
      type: "array",
      items: evidenceItem,
      description: "Evidence quotes supporting the score",
    },
  },
  required: ["id", "name", "weight", "score", "feedback", "evidence"],
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
      description:
        "2-3 strengths; each 12-25 words, ends with [mm:ss], cites concrete behavior",
    },
    improvements: {
      type: "array",
      items: { type: "string" },
      description: "2-3 actionable improvements; each 12-25 words, ends with [mm:ss]",
    },
    coachNotes: {
      type: "string",
      description:
        "40-60 words total: what happened with timestamps, then one concrete practice tip",
    },
    metrics: {
      type: "object",
      properties: {
        talkListenRatio: {
          type: "number",
          description: "Learner word-share 0-1 (learner_words / total_words)",
          minimum: 0,
          maximum: 1,
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
