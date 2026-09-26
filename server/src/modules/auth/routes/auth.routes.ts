import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../../shared/http/auth-guard.js";
import { authController } from "../controllers/auth.controller.js";

export async function registerAuthModule(app: FastifyInstance) {
  app.post("/api/v1/auth/signup", (req, reply) => authController.signup(req, reply));
  app.post("/api/v1/auth/login", (req, reply) => authController.login(req, reply));
  app.get("/api/v1/me", { preHandler: requireAuth }, (req, reply) =>
    authController.me(req, reply),
  );
}
