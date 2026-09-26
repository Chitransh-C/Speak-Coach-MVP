import type { FastifyReply, FastifyRequest } from "fastify";
import { sarvamProxyService } from "../services/sarvam.proxy.service.js";

export const sarvamProxyController = {
  async proxy(request: FastifyRequest, reply: FastifyReply) {
    const rawUrl = request.raw.url || "";
    // Strip /api/sarvam prefix → remainder is app-runtime path
    const pathAndQuery = rawUrl.replace(/^\/api\/sarvam/, "") || "/";
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? null
        : typeof request.body === "string"
          ? request.body
          : JSON.stringify(request.body ?? {});
    const result = await sarvamProxyService.forward(request.method, pathAndQuery, body);
    reply.status(result.status);
    const ct = result.headers["content-type"];
    if (ct) reply.header("content-type", ct);
    return reply.send(result.body);
  },
};
