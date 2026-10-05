/**
 * Attach a realistic sales discovery transcript to an open sales session, then score it.
 * Usage: npx tsx scripts/seed-sales-transcript.ts [sessionId]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { scoringService } from "../src/modules/scoring/services/scoring.service.js";

const prisma = new PrismaClient();
const preferredId = process.argv[2];

const turns = [
  {
    speaker: "agent",
    text: "Thanks for taking the time. Walk me through what you're trying to solve this quarter.",
  },
  {
    speaker: "learner",
    text: "Sure — our ops team is drowning in manual follow-ups. We have three tools and nobody trusts the pipeline numbers. I'm hoping to understand if you can consolidate reporting without a six-month rollout.",
  },
  {
    speaker: "agent",
    text: "What happens if you stay with the current setup for another quarter?",
  },
  {
    speaker: "learner",
    text: "We'll keep missing forecast accuracy. Last quarter we were off by about eighteen percent, and leadership is already asking for weekly reconciliation. Cost of delay is basically another analyst hire.",
  },
  {
    speaker: "agent",
    text: "Who else needs to be comfortable before you'd trial something?",
  },
  {
    speaker: "learner",
    text: "My VP of Ops and the RevOps lead. If we can show a clean pilot on one region in four weeks, I can get them into a working session next Tuesday. Does that timeline match how you usually run pilots?",
  },
];

async function main() {
  let session = preferredId
    ? await prisma.practiceSession.findUnique({
        where: { id: preferredId },
        include: { scenario: true, transcript: true },
      })
    : await prisma.practiceSession.findFirst({
        where: { scenarioId: "scenario-sales-001", status: "created" },
        include: { scenario: true, transcript: true },
        orderBy: { createdAt: "desc" },
      });

  if (!session) {
    console.error("No sales session found. Create one from the app first.");
    process.exit(1);
  }

  await prisma.practiceSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      endedAt: new Date(),
      transcript: {
        upsert: {
          create: { turns },
          update: { turns },
        },
      },
    },
  });

  console.log(`Transcript saved on ${session.id} (${session.scenario.title})`);
  const result = await scoringService.scoreSession(
    session.id,
    turns,
    session.scenario.passMark,
    session.scenario.trackId,
    { id: session.scenario.id, title: session.scenario.title },
  );
  if (result.insufficient) {
    console.error("Insufficient speech");
    process.exit(1);
  }
  console.log(
    JSON.stringify(
      {
        id: session.id,
        model: result.model,
        overall: result.score.overall,
        passed: result.score.passed,
        strengths: result.score.strengths,
        improvements: result.score.improvements,
        coach: result.score.coachNotes.slice(0, 280),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
