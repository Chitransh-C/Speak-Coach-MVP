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
  evidence: z.array(evidenceSchema).default([]),
});

export const scorecardSchema = z.object({
  overall: z.number().min(0).max(100),
  passed: z.boolean(),
  passMark: z.number().default(70),
  criteria: z.array(criterionSchema),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  coachNotes: z.string(),
  metrics: z.object({
    talkListenRatio: z.number(),
    questionsAsked: z.number(),
    fillerWordCount: z.number(),
  }),
});

export const insufficientSchema = z.object({
  insufficient: z.literal(true),
});

export type Scorecard = z.infer<typeof scorecardSchema>;
