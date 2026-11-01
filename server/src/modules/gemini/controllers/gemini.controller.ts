import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AppError } from "../../../shared/http/errors.js";
import { mintGeminiEphemeralToken } from "../services/gemini.ephemeral.service.js";
import { mintLumiAssistantToken } from "../services/gemini.assistant.service.js";
import { previewGeminiVoice } from "../services/gemini.voice-preview.service.js";

const mintSchema = z.object({
  languageCode: z.string().min(2),
  languageLabel: z.string().min(1),
  voiceId: z.string().min(1),
  gender: z.enum(["male", "female"]),
  participantName: z.string().min(1),
  agentVariables: z.record(z.string(), z.string()).default({}),
  callDurationMin: z.number().int().min(3).max(25).default(5),
});

const assistantMintSchema = z.object({
  languageCode: z.string().min(2).optional(),
  voiceId: z.string().min(1).optional(),
});

const voicePreviewSchema = z.object({
  voiceId: z.string().min(1),
  languageCode: z.string().min(2).optional(),
  text: z.string().max(160).optional(),
});

export const geminiController = {
  async mintEphemeralToken(req: FastifyRequest, reply: FastifyReply) {
    const parsed = mintSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid ephemeral token request");
    }
    const result = await mintGeminiEphemeralToken(parsed.data);
    return reply.send(result);
  },

  async mintAssistantToken(req: FastifyRequest, reply: FastifyReply) {
    const parsed = assistantMintSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid assistant token request");
    }
    const result = await mintLumiAssistantToken(parsed.data);
    return reply.send(result);
  },

  async voicePreview(req: FastifyRequest, reply: FastifyReply) {
    const parsed = voicePreviewSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid voice preview request");
    }
    const result = await previewGeminiVoice(parsed.data);
    return reply.send(result);
  },
};
