import { prisma } from "../../../shared/db/prisma.js";

export const sessionsRepository = {
  create(userId: string, scenarioId: string) {
    return prisma.practiceSession.create({
      data: { userId, scenarioId, status: "created" },
    });
  },

  findById(id: string) {
    return prisma.practiceSession.findUnique({
      where: { id },
      include: { transcript: true, score: true, latencyEvents: true },
    });
  },

  markLive(id: string) {
    return prisma.practiceSession.update({
      where: { id },
      data: { status: "live", startedAt: new Date() },
    });
  },

  async complete(
    id: string,
    data: {
      endedAt: Date;
      turns: unknown;
      latencyEvents?: { name: string; atMs: number; meta?: object }[];
    },
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.transcript.upsert({
        where: { sessionId: id },
        create: { sessionId: id, turns: data.turns as object },
        update: { turns: data.turns as object },
      });
      if (data.latencyEvents?.length) {
        await tx.latencyEvent.createMany({
          data: data.latencyEvents.map((e) => ({
            sessionId: id,
            name: e.name,
            atMs: e.atMs,
            meta: e.meta ?? undefined,
          })),
        });
      }
      return tx.practiceSession.update({
        where: { id },
        data: { status: "completed", endedAt: data.endedAt },
        include: { transcript: true, score: true },
      });
    });
  },

  markFailed(id: string) {
    return prisma.practiceSession.update({
      where: { id },
      data: { status: "failed" },
    });
  },
};
