import { prisma } from "../../../shared/db/prisma.js";

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },
  findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  },
  create(data: { email: string; passwordHash: string; displayName: string }) {
    return prisma.user.create({ data });
  },
};
