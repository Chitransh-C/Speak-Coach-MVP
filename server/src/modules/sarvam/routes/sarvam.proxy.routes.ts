import type { FastifyInstance } from "fastify";
import { sarvamProxyController } from "../controllers/sarvam.proxy.controller.js";

/** Browser ConversationAgent cannot attach JWT; key stays server-side. CORS locks callers. */
export async function registerSarvamModule(app: FastifyInstance) {
  app.all("/api/sarvam/*", (req, reply) => sarvamProxyController.proxy(req, reply));
  app.all("/api/sarvam", (req, reply) => sarvamProxyController.proxy(req, reply));
}
