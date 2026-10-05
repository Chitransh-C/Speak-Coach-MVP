import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../shared/http/auth-guard.js";
import { scenariosController } from "../controllers/scenarios.controller.js";

export async function registerScenariosModule(app: FastifyInstance) {
  app.get("/api/v1/tracks", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.listTracks(req, reply),
  );
  app.get("/api/v1/scenarios", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.list(req, reply),
  );
  app.get("/api/v1/scenarios/:scenarioId", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.get(req, reply),
  );
}
