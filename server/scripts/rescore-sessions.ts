/**
 * Re-run Gemini scoring for existing completed sessions (overwrites scores).
 * Usage: npx tsx scripts/rescore-sessions.ts <sessionId> [sessionId...]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { scoringService } from "../src/modules/scoring/services/scoring.service.js";

const ids = process.argv.slice(2);
if (!ids.length) {
  console.error("Usage: npx tsx scripts/rescore-sessions.ts <sessionId> [...]");
  process.exit(1);
}

const prisma = new PrismaClient();

type Turn = { speaker: string; text: string; startedAtMs?: number; endedAtMs?: number };

async function rescoreOne(sessionId: string) {
  const session = await prisma.practiceSession.findUnique({
    where: { id: sessionId },
    include: { transcript: true, scenario: true },
  });
  if (!session) {
    console.error(`SKIP ${sessionId}: not found`);
    return;
  }
  const turns = (session.transcript?.turns ?? []) as Turn[];
  if (!turns.length) {
    console.error(`SKIP ${sessionId}: no transcript`);
    return;
  }

  console.log(`Scoring ${sessionId} (${session.scenario.title})…`);
  const result = await scoringService.scoreSession(
    sessionId,
    turns,
    session.scenario.passMark,
    session.scenario.trackId,
    { id: session.scenario.id, title: session.scenario.title },
  );

  if (result.insufficient) {
    console.error(`INSUFFICIENT ${sessionId}`);
    return;
  }

  const s = result.score;
  console.log(
    JSON.stringify(
      {
        id: sessionId,
        model: result.model,
        overall: s.overall,
        passed: s.passed,
        strengths: s.strengths,
        improvements: s.improvements,
        talkShare: s.metrics.talkListenRatio,
        criteria: s.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          score: c.score,
          feedback: c.feedback?.slice(0, 120),
        })),
        coach: s.coachNotes.slice(0, 220),
      },
      null,
      2,
    ),
  );
}

for (const id of ids) {
  await rescoreOne(id);
}
await prisma.$disconnect();
