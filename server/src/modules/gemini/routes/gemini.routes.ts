import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../shared/http/auth-guard.js";
import { geminiController } from "../controllers/gemini.controller.js";

export async function registerGeminiModule(app: FastifyInstance) {
  app.post(
    "/api/v1/gemini/ephemeral-token",
    { preHandler: requireAuth },
    (req, reply) => geminiController.mintEphemeralToken(req, reply),
  );
  app.post(
    "/api/v1/gemini/assistant-token",
    { preHandler: requireAuth },
    (req, reply) => geminiController.mintAssistantToken(req, reply),
  );
  app.post(
    "/api/v1/gemini/voice-preview",
    { preHandler: requireAuth },
    (req, reply) => geminiController.voicePreview(req, reply),
  );
}
