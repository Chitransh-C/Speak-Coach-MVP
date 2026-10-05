import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../shared/http/auth-guard.js";
import { localesController } from "../controllers/locales.controller.js";

export async function registerLocalesModule(app: FastifyInstance) {
  app.get("/api/v1/locales", { preHandler: requireAuth }, (req, reply) =>
    localesController.get(req, reply),
  );
}
