import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../../shared/http/auth-guard.js";
import { adminController } from "../controllers/admin.controller.js";

export async function registerAdminModule(app: FastifyInstance) {
  // Encapsulate so requireAdmin does not apply to the rest of the app.
  await app.register(async (admin) => {
    admin.addHook("preHandler", requireAdmin);

    admin.get("/stats", (req, reply) => adminController.stats(req, reply));
    admin.get("/health", (req, reply) => adminController.health(req, reply));
    admin.get("/locales", (req, reply) => adminController.locales(req, reply));

    admin.get("/users", (req, reply) => adminController.listUsers(req, reply));
    admin.get("/users/:id", (req, reply) => adminController.getUser(req, reply));
    admin.patch("/users/:id", (req, reply) => adminController.patchUser(req, reply));

    admin.get("/tracks", (req, reply) => adminController.listTracks(req, reply));
    admin.post("/tracks", (req, reply) => adminController.createTrack(req, reply));
    admin.patch("/tracks/:id", (req, reply) => adminController.patchTrack(req, reply));
    admin.delete("/tracks/:id", (req, reply) => adminController.deleteTrack(req, reply));

    admin.get("/scenarios", (req, reply) => adminController.listScenarios(req, reply));
    admin.get("/scenarios/:id", (req, reply) => adminController.getScenario(req, reply));
    admin.post("/scenarios", (req, reply) => adminController.createScenario(req, reply));
    admin.patch("/scenarios/:id", (req, reply) => adminController.patchScenario(req, reply));
    admin.delete("/scenarios/:id", (req, reply) => adminController.deleteScenario(req, reply));

    admin.get("/prompts", (req, reply) => adminController.listPrompts(req, reply));
    admin.get("/prompts/:id", (req, reply) => adminController.getPrompt(req, reply));
    admin.patch("/prompts/:id", (req, reply) => adminController.patchPrompt(req, reply));

    admin.get("/sessions", (req, reply) => adminController.listSessions(req, reply));
    admin.get("/sessions/:id", (req, reply) => adminController.getSession(req, reply));
    admin.post("/sessions/:id/rescore", (req, reply) =>
      adminController.rescoreSession(req, reply),
    );
  }, { prefix: "/api/v1/admin" });
}
