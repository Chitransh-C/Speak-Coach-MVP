import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const rows = await p.practiceSession.findMany({
  orderBy: { createdAt: "desc" },
  take: 10,
  include: {
    score: true,
    transcript: true,
    scenario: { select: { id: true, title: true, trackId: true, passMark: true } },
  },
});

for (const s of rows) {
  const turns = Array.isArray(s.transcript?.turns) ? s.transcript.turns.length : 0;
  const strengths = s.score?.strengths;
  console.log(
    JSON.stringify(
      {
        id: s.id,
        scenario: s.scenarioId,
        title: s.scenario.title,
        track: s.scenario.trackId,
        status: s.status,
        overall: s.score?.overall ?? null,
        passed: s.score?.passed ?? null,
        model: s.score?.model ?? null,
        turns,
        strengths,
        coach: String(s.score?.coachNotes || "").slice(0, 160),
      },
      null,
      0,
    ),
  );
}
await p.$disconnect();
