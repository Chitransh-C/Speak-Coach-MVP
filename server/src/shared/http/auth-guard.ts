import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

export type UserRole = "learner" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

function normalizeRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "learner";
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: normalizeRole(user.role),
    },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthUser & {
      role?: string;
    };
    request.user = {
      id: payload.id,
      email: payload.email,
      displayName: payload.displayName,
      role: normalizeRole(payload.role),
    };
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid token");
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (request.user?.role !== "admin") {
    throw new AppError(403, "FORBIDDEN", "Admin access required");
  }
}
