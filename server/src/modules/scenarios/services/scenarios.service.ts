import { prisma } from "../../../shared/db/prisma.js";
import { AppError } from "../../../shared/http/errors.js";
import {
  defaultVoiceForGender,
  listLanguages,
  listVoices,
} from "../../../shared/catalog/locale.js";
import {
  participantGender,
  participantName,
  scenariosRepository,
} from "../repositories/scenarios.repository.js";
import { canPracticeScenario } from "./voice-agent.resolve.js";

async function userStatusForScenario(userId: string, scenarioId: string) {
  const completed = await prisma.practiceSession.findFirst({
    where: { userId, scenarioId, status: "completed" },
    orderBy: { createdAt: "desc" },
    include: { score: true },
  });
  return {
    status: completed ? ("completed" as const) : ("not_started" as const),
    latestScore: completed?.score
      ? {
          overall: completed.score.overall,
          passed: completed.score.passed,
          sessionId: completed.id,
        }
      : null,
  };
}

export const scenariosService = {
  async listTracks() {
    const tracks = await scenariosRepository.listTracks();
    return {
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        sortOrder: t.sortOrder,
        scenarioCount: t._count.scenarios,
      })),
    };
  },

  async listForUser(userId: string, trackId?: string) {
    if (trackId) {
      const track = await prisma.track.findUnique({ where: { id: trackId } });
      if (!track) throw new AppError(404, "NOT_FOUND", "Track not found");
    }
    const scenarios = await scenariosRepository.listScenarios(trackId);
    const cards = await Promise.all(
      scenarios.map(async (s) => {
        const progress = await userStatusForScenario(userId, s.id);
        const learn = s.learn as {
          participant?: { name?: string; role?: string };
        } | null;
        return {
          id: s.id,
          title: s.title,
          description: s.description,
          trackId: s.trackId,
          trackTitle: s.track.title,
          level: s.level,
          estDurationMin: s.estDurationMin,
          availability: s.availability,
          participantName: participantName(s),
          participantRole: learn?.participant?.role?.trim() || null,
          status: progress.status,
          latestScore: progress.latestScore
            ? {
                overall: progress.latestScore.overall,
                passed: progress.latestScore.passed,
              }
            : null,
        };
      }),
    );
    return { scenarios: cards };
  },

  async getById(userId: string, scenarioId: string) {
    const scenario = await scenariosRepository.findById(scenarioId);
    if (!scenario) {
      throw new AppError(404, "NOT_FOUND", "Scenario not found");
    }
    const progress = await userStatusForScenario(userId, scenarioId);
    const gender = participantGender(scenario);
    const languages = listLanguages();
    const voices = listVoices(gender);
    const defaultLanguage = listLanguages().some((l) => l.code === scenario.defaultLanguage)
      ? scenario.defaultLanguage
      : "en-IN";
    const defaultVoice = isVoiceInList(scenario.defaultVoice, voices)
      ? scenario.defaultVoice
      : defaultVoiceForGender(gender);

    return {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      trackId: scenario.trackId,
      trackTitle: scenario.track.title,
      level: scenario.level,
      estDurationMin: scenario.estDurationMin,
      practiceCallMin: scenario.practiceCallMin,
      points: scenario.points,
      passMark: scenario.passMark,
      availability: scenario.availability,
      participantGender: gender,
      /** @deprecated use `languages` objects — kept as codes for older clients */
      languageCodes: languages.map((l) => l.code),
      languages,
      voices,
      defaults: {
        language: defaultLanguage,
        voice: defaultVoice,
      },
      learn: scenario.learn,
      watch: scenario.watch,
      status: progress.status,
      latestScore: progress.latestScore,
      canPractice: canPracticeScenario(scenario),
      agentSource: canPracticeScenario(scenario)
        ? scenario.sarvamAppId
          ? "scenario"
          : "track"
        : null,
    };
  },
};

function isVoiceInList(id: string, voices: { id: string }[]): boolean {
  return voices.some((v) => v.id === id);
}
