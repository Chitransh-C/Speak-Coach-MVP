import bcrypt from "bcryptjs";
import { AppError } from "../../../shared/http/errors.js";
import { signToken, type AuthUser } from "../../../shared/http/auth-guard.js";
import { authRepository } from "../repositories/auth.repository.js";
import type { LoginInput, SignupInput } from "../schemas/auth.schemas.js";

function toAuthUser(user: {
  id: string;
  email: string;
  displayName: string;
}): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}

export const authService = {
  async signup(input: SignupInput) {
    const existing = await authRepository.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new AppError(409, "VALIDATION_ERROR", "Email already registered");
    }
    const passwordHash = await bcrypt.hash(input.password, 10);
    const user = await authRepository.create({
      email: input.email.toLowerCase(),
      passwordHash,
      displayName: input.displayName,
    });
    const authUser = toAuthUser(user);
    return { user: authUser, token: signToken(authUser) };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email.toLowerCase());
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid email or password");
    }
    const authUser = toAuthUser(user);
    return { user: authUser, token: signToken(authUser) };
  },

  async me(userId: string) {
    const user = await authRepository.findById(userId);
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "User not found");
    }
    return toAuthUser(user);
  },
};
