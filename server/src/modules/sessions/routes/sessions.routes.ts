import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../shared/http/auth-guard.js";
import { sessionsController } from "../controllers/sessions.controller.js";

export async function registerSessionsModule(app: FastifyInstance) {
  app.post("/api/v1/sessions", { preHandler: requireAuth }, (req, reply) =>
    sessionsController.create(req, reply),
  );
  app.get("/api/v1/sessions/:sessionId", { preHandler: requireAuth }, (req, reply) =>
    sessionsController.get(req, reply),
  );
  app.post(
    "/api/v1/sessions/:sessionId/complete",
    { preHandler: requireAuth },
    (req, reply) => sessionsController.complete(req, reply),
  );
}
