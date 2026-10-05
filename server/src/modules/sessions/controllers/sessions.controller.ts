import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../shared/http/errors.js";
import { sessionsService } from "../services/sessions.service.js";
import {
  completeSessionSchema,
  createSessionSchema,
} from "../schemas/sessions.schemas.js";

export const sessionsController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const parsed = createSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.message);
    }
    const result = await sessionsService.create(request.user.id, parsed.data);
    return reply.code(201).send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    return reply.send(await sessionsService.list(request.user.id));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { sessionId } = request.params as { sessionId: string };
    return reply.send(await sessionsService.get(request.user.id, sessionId));
  },

  async complete(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { sessionId } = request.params as { sessionId: string };
    const parsed = completeSessionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.message);
    }
    return reply.send(
      await sessionsService.complete(request.user.id, sessionId, parsed.data),
    );
  },
};
