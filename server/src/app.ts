import Fastify from "fastify";
import cors from "@fastify/cors";
import { corsOrigins } from "./shared/config/env.js";
import { toErrorPayload, AppError } from "./shared/http/errors.js";
import { logger } from "./shared/logging/logger.js";
import { registerAuthModule } from "./modules/auth/index.js";
import { registerLocalesModule } from "./modules/locales/index.js";
import { registerScenariosModule } from "./modules/scenarios/index.js";
import { registerSessionsModule } from "./modules/sessions/index.js";
import { registerSarvamModule } from "./modules/sarvam/index.js";

export async function buildApp() {
  const app = Fastify({ logger: false });
  const allowed = corsOrigins();

  await app.register(cors, {
    origin(origin, cb) {
      // Same-origin / non-browser tools (no Origin header)
      if (!origin) return cb(null, true);
      if (allowed.includes("*") || allowed.includes(origin)) return cb(null, true);
      logger.warn("CORS blocked", origin);
      cb(null, false);
    },
    credentials: true,
  });

  app.setErrorHandler((err, _req, reply) => {
    const { statusCode, body } = toErrorPayload(err);
    if (!(err instanceof AppError)) {
      logger.error(err);
    }
    reply.status(statusCode).send(body);
  });

  app.get("/health", async () => ({ ok: true }));

  await registerAuthModule(app);
  await registerLocalesModule(app);
  await registerScenariosModule(app);
  await registerSessionsModule(app);
  await registerSarvamModule(app);

  return app;
}
