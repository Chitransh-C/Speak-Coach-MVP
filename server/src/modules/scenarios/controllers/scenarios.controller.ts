import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../shared/http/errors.js";
import { scenariosService } from "../services/scenarios.service.js";

export const scenariosController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    return reply.send(await scenariosService.listForUser(request.user.id));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { scenarioId } = request.params as { scenarioId: string };
    return reply.send(await scenariosService.getById(request.user.id, scenarioId));
  },
};
