import { prisma } from "../../../shared/db/prisma.js";
import type { Scorecard } from "../schemas/scorecard.schemas.js";

export const scoringRepository = {
  upsertScore(sessionId: string, score: Scorecard, model: string) {
    return prisma.score.upsert({
      where: { sessionId },
      create: {
        sessionId,
        overall: score.overall,
        passed: score.passed,
        criteria: score.criteria,
        strengths: score.strengths,
        improvements: score.improvements,
        coachNotes: score.coachNotes,
        metrics: score.metrics,
        model,
      },
      update: {
        overall: score.overall,
        passed: score.passed,
        criteria: score.criteria,
        strengths: score.strengths,
        improvements: score.improvements,
        coachNotes: score.coachNotes,
        metrics: score.metrics,
        model,
      },
    });
  },
};
