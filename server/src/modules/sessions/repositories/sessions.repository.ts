import { prisma } from "../../../shared/db/prisma.js";

export const sessionsRepository = {
  create(
    userId: string,
    scenarioId: string,
    setup: { language: string; voice: string },
  ) {
    return prisma.practiceSession.create({
      data: {
        userId,
        scenarioId,
        status: "created",
        language: setup.language,
        voice: setup.voice,
      },
    });
  },

  findById(id: string) {
    return prisma.practiceSession.findUnique({
      where: { id },
      include: {
        transcript: true,
        score: true,
        latencyEvents: true,
        scenario: true,
      },
    });
  },

  listForUser(userId: string, limit = 50) {
    return prisma.practiceSession.findMany({
      where: { userId, status: "completed" },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        score: true,
        scenario: { include: { track: true } },
      },
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
        include: { transcript: true, score: true, scenario: true },
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
