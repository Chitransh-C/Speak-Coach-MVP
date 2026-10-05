import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const rows = await p.practiceSession.findMany({
  where: { status: "completed" },
  orderBy: { createdAt: "desc" },
  include: {
    score: true,
    scenario: { select: { title: true, trackId: true } },
    user: { select: { email: true, id: true } },
  },
});

for (const s of rows) {
  console.log(
    JSON.stringify({
      id: s.id,
      email: s.user.email,
      title: s.scenario.title,
      track: s.scenario.trackId,
      createdAt: s.createdAt.toISOString(),
      overall: s.score?.overall ?? null,
      model: s.score?.model ?? null,
      coach: String(s.score?.coachNotes || "").slice(0, 100),
    }),
  );
}
await p.$disconnect();
