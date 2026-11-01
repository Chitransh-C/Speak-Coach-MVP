import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../shared/http/errors.js";
import {
  scenarioWritePatchSchema,
  scenarioWriteSchema,
} from "../../../shared/schemas/scenario-write.schema.js";
import { scenariosService } from "../services/scenarios.service.js";

export const scenariosController = {
  async listTracks(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const q = request.query as { includePersonal?: string };
    const includePersonal =
      q.includePersonal === "1" ||
      q.includePersonal === "true" ||
      q.includePersonal === "yes";
    return reply.send(
      await scenariosService.listTracks(request.user.id, { includePersonal }),
    );
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { trackId } = request.query as { trackId?: string };
    return reply.send(await scenariosService.listForUser(request.user.id, trackId));
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { scenarioId } = request.params as { scenarioId: string };
    return reply.send(await scenariosService.getById(request.user.id, scenarioId));
  },

  async listMine(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    return reply.send(await scenariosService.listMine(request.user.id));
  },

  async createMine(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const raw = (request.body && typeof request.body === "object" ? request.body : {}) as Record<
      string,
      unknown
    >;
    // Personal creates default to live so the owner can practice immediately.
    const withDefault = {
      ...raw,
      availability: raw.availability ?? "live",
    };
    const parsed = scenarioWriteSchema.safeParse(withDefault);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body");
    }
    return reply.code(201).send(await scenariosService.createMine(request.user.id, parsed.data));
  },

  async getMine(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { scenarioId } = request.params as { scenarioId: string };
    return reply.send(await scenariosService.getMine(request.user.id, scenarioId));
  },

  async patchMine(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { scenarioId } = request.params as { scenarioId: string };
    const parsed = scenarioWritePatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body");
    }
    return reply.send(await scenariosService.patchMine(request.user.id, scenarioId, parsed.data));
  },

  async deleteMine(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    const { scenarioId } = request.params as { scenarioId: string };
    return reply.send(await scenariosService.deleteMine(request.user.id, scenarioId));
  },
};
