import { z } from "zod";

/** Shared create/patch body for admin global + learner personal scenarios. */
export const scenarioWriteSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/i, "id must be alphanumeric/hyphen")
    .optional(),
  trackId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  level: z.string().min(1).max(40).default("beginner"),
  estDurationMin: z.number().int().min(1).max(120).default(15),
  practiceCallMin: z.number().int().min(3).max(25).default(5),
  points: z.number().int().min(0).max(1000).default(100),
  passMark: z.number().int().min(0).max(100).default(70),
  availability: z.enum(["live", "coming_soon"]).default("coming_soon"),
  languages: z.array(z.string()).default(["en-IN"]),
  voices: z.array(z.string()).default([]),
  defaultLanguage: z.string().min(2).default("en-IN"),
  defaultVoice: z.string().min(1).default("Charon"),
  learn: z.record(z.string(), z.unknown()).or(z.object({}).passthrough()),
  watch: z.record(z.string(), z.unknown()).or(z.object({}).passthrough()),
});

export const scenarioWritePatchSchema = scenarioWriteSchema.partial();

export type ScenarioWriteInput = z.infer<typeof scenarioWriteSchema>;
export type ScenarioWritePatchInput = z.infer<typeof scenarioWritePatchSchema>;
