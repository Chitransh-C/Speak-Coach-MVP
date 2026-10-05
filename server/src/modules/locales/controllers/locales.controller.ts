import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../../shared/http/errors.js";
import { localesPayload } from "../../../shared/catalog/locale.js";

export const localesController = {
  async get(_request: FastifyRequest, reply: FastifyReply) {
    if (!_request.user) throw new AppError(401, "UNAUTHORIZED", "Missing user");
    return reply.send(localesPayload());
  },
};
