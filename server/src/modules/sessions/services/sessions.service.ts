import { AppError } from "../../../shared/http/errors.js";
import { sarvamProxyService } from "../../sarvam/services/sarvam.proxy.service.js";
import { scoringService } from "../../scoring/services/scoring.service.js";
import { sessionsRepository } from "../repositories/sessions.repository.js";
import type {
  CompleteSessionInput,
  CreateSessionInput,
} from "../schemas/sessions.schemas.js";

export const sessionsService = {
  async create(userId: string, input: CreateSessionInput, _requestHostOrigin: string) {
    const session = await sessionsRepository.create(userId, input.scenarioId);
    // Relative path: Vite proxies /api → API in dev; same-origin in production reverse proxy.
    const agent = sarvamProxyService.getClientConfig("/api/sarvam");
    return {
      sessionId: session.id,
      status: session.status,
      agent,
      tips: {
        micGainHint:
          "Laptop array mics often need software gain (~8x). Prefer a headset mic for demos.",
        language: "English",
      },
    };
  },

  async get(userId: string, sessionId: string) {
    const session = await sessionsRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppError(404, "NOT_FOUND", "Session not found");
    }
    return {
      id: session.id,
      scenarioId: session.scenarioId,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      transcript: session.transcript?.turns ?? null,
      score: session.score
        ? {
            overall: session.score.overall,
            passed: session.score.passed,
            criteria: session.score.criteria,
            strengths: session.score.strengths,
            improvements: session.score.improvements,
            coachNotes: session.score.coachNotes,
            metrics: session.score.metrics,
            model: session.score.model,
          }
        : null,
    };
  },

  async complete(userId: string, sessionId: string, input: CompleteSessionInput) {
    const session = await sessionsRepository.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new AppError(404, "NOT_FOUND", "Session not found");
    }
    if (session.status === "completed" && session.score) {
      return {
        sessionId,
        status: "completed" as const,
        score: {
          overall: session.score.overall,
          passed: session.score.passed,
          criteria: session.score.criteria,
          strengths: session.score.strengths,
          improvements: session.score.improvements,
          coachNotes: session.score.coachNotes,
          metrics: session.score.metrics,
        },
      };
    }

    const endedAt = input.endedAt ? new Date(input.endedAt) : new Date();
    await sessionsRepository.complete(sessionId, {
      endedAt,
      turns: input.transcript.turns,
      latencyEvents: input.latency?.events,
    });

    const result = await scoringService.scoreSession(sessionId, input.transcript.turns);
    if (result.insufficient) {
      await sessionsRepository.markFailed(sessionId);
      throw new AppError(
        422,
        "INSUFFICIENT_TRANSCRIPT",
        "Not enough learner speech to score. Practice again and speak for at least ~40 words.",
      );
    }

    return {
      sessionId,
      status: "completed" as const,
      score: result.score,
    };
  },
};
