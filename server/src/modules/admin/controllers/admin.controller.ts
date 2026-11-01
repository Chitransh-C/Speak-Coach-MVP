import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../shared/http/errors.js";
import { adminService } from "../services/admin.service.js";
import {
  patchUserSchema,
  promptPatchSchema,
  scenarioCreateSchema,
  scenarioPatchSchema,
  trackCreateSchema,
  trackPatchSchema,
} from "../schemas/admin.schemas.js";

function adminId(req: FastifyRequest) {
  return req.user!.id;
}

export const adminController = {
  async stats(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await adminService.stats());
  },

  async health(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await adminService.health());
  },

  async locales(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send(adminService.locales());
  },

  async listUsers(req: FastifyRequest, reply: FastifyReply) {
    const q = req.query as { q?: string; role?: string };
    return reply.send(await adminService.listUsers(q));
  },

  async getUser(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.getUser(id));
  },

  async patchUser(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const parsed = patchUserSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid user patch");
    return reply.send(await adminService.patchUser(adminId(req), id, parsed.data));
  },

  async listTracks(_req: FastifyRequest, reply: FastifyReply) {
    return reply.send(await adminService.listTracks());
  },

  async createTrack(req: FastifyRequest, reply: FastifyReply) {
    const parsed = trackCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid track");
    return reply.code(201).send(await adminService.createTrack(adminId(req), parsed.data));
  },

  async patchTrack(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const parsed = trackPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid track patch");
    return reply.send(await adminService.patchTrack(adminId(req), id, parsed.data));
  },

  async deleteTrack(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.deleteTrack(adminId(req), id));
  },

  async listScenarios(req: FastifyRequest, reply: FastifyReply) {
    const q = req.query as { trackId?: string; availability?: string };
    return reply.send(await adminService.listScenarios(q));
  },

  async getScenario(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.getScenario(id));
  },

  async createScenario(req: FastifyRequest, reply: FastifyReply) {
    const parsed = scenarioCreateSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid scenario");
    return reply.code(201).send(await adminService.createScenario(adminId(req), parsed.data));
  },

  async patchScenario(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const parsed = scenarioPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid scenario patch");
    return reply.send(await adminService.patchScenario(adminId(req), id, parsed.data));
  },

  async deleteScenario(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.deleteScenario(adminId(req), id));
  },

  async listPrompts(req: FastifyRequest, reply: FastifyReply) {
    const q = req.query as { kind?: string; trackId?: string };
    return reply.send(await adminService.listPrompts(q));
  },

  async getPrompt(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.getPrompt(id));
  },

  async patchPrompt(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const parsed = promptPatchSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid prompt patch");
    return reply.send(await adminService.patchPrompt(adminId(req), id, parsed.data));
  },

  async listSessions(req: FastifyRequest, reply: FastifyReply) {
    const q = req.query as {
      q?: string;
      scenarioId?: string;
      status?: string;
      language?: string;
    };
    return reply.send(await adminService.listSessions(q));
  },

  async getSession(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.getSession(id));
  },

  async rescoreSession(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return reply.send(await adminService.rescoreSession(adminId(req), id));
  },
};
