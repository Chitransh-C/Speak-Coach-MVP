import { prisma } from "../../../shared/db/prisma.js";
import { AppError } from "../../../shared/http/errors.js";
import { scenariosRepository } from "../repositories/scenarios.repository.js";

export const scenariosService = {
  async listForUser(userId: string) {
    const scenario = scenariosRepository.getScenario001();
    const completed = await prisma.practiceSession.findFirst({
      where: { userId, scenarioId: scenario.id, status: "completed" },
      orderBy: { createdAt: "desc" },
      include: { score: true },
    });
    const status = completed ? "completed" : "not_started";
    return {
      scenarios: [
        {
          id: scenario.id,
          title: scenario.title,
          description: scenario.description,
          level: scenario.level,
          estDurationMin: scenario.estDurationMin,
          status,
          latestScore: completed?.score
            ? { overall: completed.score.overall, passed: completed.score.passed }
            : null,
        },
      ],
    };
  },

  async getById(userId: string, scenarioId: string) {
    if (scenarioId !== "scenario-001") {
      throw new AppError(404, "NOT_FOUND", "Scenario not found");
    }
    const scenario = scenariosRepository.getScenario001();
    const completed = await prisma.practiceSession.findFirst({
      where: { userId, scenarioId, status: "completed" },
      orderBy: { createdAt: "desc" },
      include: { score: true },
    });
    return {
      ...scenario,
      status: completed ? "completed" : "not_started",
      latestScore: completed?.score
        ? {
            overall: completed.score.overall,
            passed: completed.score.passed,
            sessionId: completed.id,
          }
        : null,
    };
  },
};
