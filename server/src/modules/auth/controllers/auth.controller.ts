import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../shared/http/errors.js";
import { authService } from "../services/auth.service.js";
import { loginSchema, signupSchema } from "../schemas/auth.schemas.js";

export const authController = {
  async signup(request: FastifyRequest, reply: FastifyReply) {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.message);
    }
    const result = await authService.signup(parsed.data);
    return reply.code(201).send(result);
  },

  async login(request: FastifyRequest, reply: FastifyReply) {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "VALIDATION_ERROR", parsed.error.message);
    }
    const result = await authService.login(parsed.data);
    return reply.send(result);
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      throw new AppError(401, "UNAUTHORIZED", "Missing user");
    }
    const user = await authService.me(request.user.id);
    return reply.send(user);
  },
};
