import { buildApp } from "./app.js";
import { env } from "./shared/config/env.js";
import { logger } from "./shared/logging/logger.js";

async function main() {
  const app = await buildApp();
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  logger.info(`SpeakCoach API on http://localhost:${env.PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
