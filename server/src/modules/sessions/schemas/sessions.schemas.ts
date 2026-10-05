import { z } from "zod";

export const createSessionSchema = z.object({
  scenarioId: z.string().min(1),
  language: z.string().min(1).optional(),
  voice: z.string().min(1).optional(),
});

export const turnSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
  startedAtMs: z.number().int().nonnegative().optional(),
  endedAtMs: z.number().int().nonnegative().optional(),
});

export const completeSessionSchema = z.object({
  endedAt: z.string().datetime().optional(),
  transcript: z.object({
    turns: z.array(turnSchema).min(1),
  }),
  latency: z
    .object({
      events: z
        .array(
          z.object({
            name: z.string(),
            atMs: z.number().int(),
            meta: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;
