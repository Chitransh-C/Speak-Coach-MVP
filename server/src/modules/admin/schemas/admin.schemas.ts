import { z } from "zod";
import {
  scenarioWritePatchSchema,
  scenarioWriteSchema,
} from "../../../shared/schemas/scenario-write.schema.js";

export const patchUserSchema = z.object({
  role: z.enum(["learner", "admin"]).optional(),
  disabled: z.boolean().optional(),
  displayName: z.string().min(1).max(80).optional(),
  tempPassword: z.string().min(8).max(128).optional(),
});

export const trackCreateSchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/i, "id must be alphanumeric/hyphen"),
  title: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  sortOrder: z.number().int().default(0),
});

export const trackPatchSchema = trackCreateSchema.partial().omit({ id: true });

export const scenarioCreateSchema = scenarioWriteSchema.extend({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/i, "id must be alphanumeric/hyphen"),
  trackId: z.string().min(1),
});

export const scenarioPatchSchema = scenarioWritePatchSchema;

export const promptPatchSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1),
});

export type PatchUserInput = z.infer<typeof patchUserSchema>;
export type TrackCreateInput = z.infer<typeof trackCreateSchema>;
export type TrackPatchInput = z.infer<typeof trackPatchSchema>;
export type ScenarioCreateInput = z.infer<typeof scenarioCreateSchema>;
export type ScenarioPatchInput = z.infer<typeof scenarioPatchSchema>;
export type PromptPatchInput = z.infer<typeof promptPatchSchema>;
