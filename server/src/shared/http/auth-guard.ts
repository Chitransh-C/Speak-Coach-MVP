import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

export type AuthUser = { id: string; email: string; displayName: string };

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export function signToken(user: AuthUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser;
    request.user = payload;
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid token");
  }
}
