import { z } from "zod";

export const evidenceSchema = z.object({
  timestampMs: z.number().nullable().optional(),
  quote: z.string(),
  note: z.string(),
});

export const criterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  weight: z.number(),
  score: z.number().min(0).max(100),
  /** Narrative why this criterion scored as it did (timestamped when possible). */
  feedback: z.string().default(""),
  evidence: z.array(evidenceSchema).default([]),
});

export const scorecardSchema = z.object({
  overall: z.number().min(0).max(100),
  passed: z.boolean(),
  passMark: z.number().default(70),
  criteria: z.array(criterionSchema),
  strengths: z.array(z.string()).default([]),
  improvements: z.array(z.string()).default([]),
  coachNotes: z.string().default(""),
  metrics: z
    .object({
      talkListenRatio: z.number(),
      questionsAsked: z.number(),
      fillerWordCount: z.number(),
    })
    .default({
      talkListenRatio: 0.5,
      questionsAsked: 0,
      fillerWordCount: 0,
    }),
});

export const insufficientSchema = z.object({
  insufficient: z.literal(true),
});

export type Scorecard = z.infer<typeof scorecardSchema>;
