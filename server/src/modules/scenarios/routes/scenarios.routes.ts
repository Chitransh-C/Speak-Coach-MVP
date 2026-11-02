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

  // Personal scenarios — register before :scenarioId to avoid capturing "mine"
  app.get("/api/v1/scenarios/mine", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.listMine(req, reply),
  );
  app.post("/api/v1/scenarios/mine", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.createMine(req, reply),
  );
  app.get("/api/v1/scenarios/mine/:scenarioId", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.getMine(req, reply),
  );
  app.patch("/api/v1/scenarios/mine/:scenarioId", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.patchMine(req, reply),
  );
  app.delete("/api/v1/scenarios/mine/:scenarioId", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.deleteMine(req, reply),
  );

  app.get("/api/v1/scenarios/:scenarioId", { preHandler: requireAuth }, (req, reply) =>
    scenariosController.get(req, reply),
  );
}
