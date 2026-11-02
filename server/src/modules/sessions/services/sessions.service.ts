import { AppError } from "../../../shared/http/errors.js";
import { env } from "../../../shared/config/env.js";
import {
  defaultVoiceForGender,
  isLanguageCode,
  isVoiceId,
  languageLabel as resolveLanguageLabel,
  normalizeVoiceId,
} from "../../../shared/catalog/locale.js";
import { getVoiceRuntime } from "../../ai/voice/index.js";
import { clampCallDurationMin } from "../../gemini/services/gemini.ephemeral.service.js";
import { scoringService } from "../../scoring/services/scoring.service.js";
import {
  canPracticeOwnedScenario,
  participantGender,
  participantName,
  scenariosRepository,
} from "../../scenarios/repositories/scenarios.repository.js";
import { buildAgentVariables } from "../../scenarios/services/voice-agent.resolve.js";
import { sessionsRepository } from "../repositories/sessions.repository.js";
import type {
  CompleteSessionInput,
  CreateSessionInput,
} from "../schemas/sessions.schemas.js";

function isEnglishLocale(code: string): boolean {
  return code === "en-IN" || code === "en-US";
}

export const sessionsService = {
  async create(userId: string, input: CreateSessionInput) {
    const scenario = await scenariosRepository.findById(input.scenarioId);
    if (!scenario || !canPracticeOwnedScenario(scenario, userId)) {
      if (!scenario || scenario.ownerUserId != null) {
        throw new AppError(404, "NOT_FOUND", "Scenario not found");
      }
      throw new AppError(409, "SCENARIO_UNAVAILABLE", "Scenario is not available for practice yet");
    }
    if (!env.GEMINI_API_KEY?.trim()) {
      throw new AppError(503, "VOICE_UNAVAILABLE", "GEMINI_API_KEY is required for live practice");
    }

    const gender = participantGender(scenario);

    if (input.language && !isLanguageCode(input.language)) {
      throw new AppError(400, "VALIDATION_ERROR", "Language is not supported");
    }
    if (input.voice && !isVoiceId(input.voice, gender)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Voice must match the character gender (${gender})`,
      );
    }

    const language =
      input.language && isLanguageCode(input.language) ? input.language : "en-IN";
    const voice = normalizeVoiceId(
      input.voice && isVoiceId(input.voice, gender)
        ? input.voice
        : defaultVoiceForGender(gender),
    );
    const languageLabel = resolveLanguageLabel(language);

    const session = await sessionsRepository.create(userId, scenario.id, {
      language,
      voice,
    });

    const baseVariables = buildAgentVariables(scenario);
    const agentVariables = {
      ...baseVariables,
      call_language: languageLabel,
      ...(isEnglishLocale(language) ? {} : { greeting: "" }),
    };
    const initialBotMessage = isEnglishLocale(language)
      ? agentVariables.greeting
      : undefined;

    const voiceBootstrap = getVoiceRuntime().buildClientBootstrap({
      language,
      languageLabel,
      voice,
      gender,
      initialBotMessage,
      agentVariables,
    });

    const practiceCallMin = clampCallDurationMin(scenario.practiceCallMin);

    return {
      sessionId: session.id,
      status: session.status,
      scenarioId: scenario.id,
      trackId: scenario.trackId,
      language,
      languageLabel,
      voice,
      practiceCallMin,
      callDurationMin: practiceCallMin,
      participantGender: gender,
      participantName: participantName(scenario),
      agentSource: "gemini" as const,
      voiceProvider: "gemini" as const,
      voiceRuntime: {
        ...voiceBootstrap,
        config: {
          ...voiceBootstrap.config,
          callDurationMin: practiceCallMin,
        },
      },
      tips: {
        micGainHint:
          "Laptop array mics often need software gain (~8x). Prefer a headset mic for demos.",
        language,
        voice,
        practiceCallMin,
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
      language: session.language,
      voice: session.voice,
      participantName: participantName(session.scenario),
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      transcript: session.transcript?.turns ?? null,
      passMark: session.scenario.passMark,
      scenarioTitle: session.scenario.title,
      trackId: session.scenario.trackId,
      score: session.score
        ? {
            overall: session.score.overall,
            passed: session.score.passed,
            passMark: session.scenario.passMark,
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

  async list(userId: string) {
    const rows = await sessionsRepository.listForUser(userId);
    const sessions = rows.map((s) => ({
      id: s.id,
      scenarioId: s.scenarioId,
      scenarioTitle: s.scenario.title,
      trackId: s.scenario.trackId,
      trackTitle: s.scenario.track.title,
      status: s.status,
      language: s.language,
      voice: s.voice,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
      durationMs: s.durationMs,
      score: s.score
        ? { overall: s.score.overall, passed: s.score.passed }
        : null,
    }));
    const scored = sessions.filter((s) => s.score);
    const avg =
      scored.length > 0
        ? Math.round(
            scored.reduce((sum, s) => sum + (s.score?.overall ?? 0), 0) / scored.length,
          )
        : null;
    const passed = scored.filter((s) => s.score?.passed).length;
    return {
      sessions,
      summary: {
        total: sessions.length,
        avgScore: avg,
        passRate: scored.length ? Math.round((passed / scored.length) * 100) : null,
        passed,
      },
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

    const result = await scoringService.scoreSession(
      sessionId,
      input.transcript.turns,
      session.scenario.passMark,
      session.scenario.trackId,
      { id: session.scenario.id, title: session.scenario.title },
    );
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
