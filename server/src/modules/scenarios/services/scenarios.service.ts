import { randomUUID } from "node:crypto";
import { prisma } from "../../../shared/db/prisma.js";
import { AppError } from "../../../shared/http/errors.js";
import {
  defaultVoiceForGender,
  listLanguages,
  listVoices,
  normalizeVoiceId,
} from "../../../shared/catalog/locale.js";
import type {
  ScenarioWriteInput,
  ScenarioWritePatchInput,
} from "../../../shared/schemas/scenario-write.schema.js";
import {
  PERSONAL_TRACK_ID,
  canAccessScenario,
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

function toCard(
  s: Awaited<ReturnType<typeof scenariosRepository.listGlobalScenarios>>[number],
  progress: Awaited<ReturnType<typeof userStatusForScenario>>,
) {
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
    practiceCallMin: s.practiceCallMin,
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
}

function detailPayload(
  scenario: NonNullable<Awaited<ReturnType<typeof scenariosRepository.findById>>>,
  progress: Awaited<ReturnType<typeof userStatusForScenario>>,
) {
  const gender = participantGender(scenario);
  const languages = listLanguages();
  const voices = listVoices(gender);
  const defaultLanguage = listLanguages().some((l) => l.code === scenario.defaultLanguage)
    ? scenario.defaultLanguage
    : "en-IN";
  const normalizedDefault = normalizeVoiceId(scenario.defaultVoice);
  const defaultVoice = isVoiceInList(normalizedDefault, voices)
    ? normalizedDefault
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
    ownerUserId: scenario.ownerUserId,
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
    agentSource: canPracticeScenario(scenario) ? ("gemini" as const) : null,
  };
}

export const scenariosService = {
  /**
   * Catalog tracks by default. Pass `includePersonal` to append the Personal track
   * with the current user's owned scenario count (Track → Scenario hierarchy).
   */
  async listTracks(userId: string, opts?: { includePersonal?: boolean }) {
    const tracks = await scenariosRepository.listCatalogTracks();
    const mapped = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      sortOrder: t.sortOrder,
      scenarioCount: t._count.scenarios,
      kind: "catalog" as const,
    }));

    if (!opts?.includePersonal) {
      return { tracks: mapped };
    }

    await ensurePersonalTrack();
    const personal = await scenariosRepository.findPersonalTrack();
    const mineCount = await scenariosRepository.countMine(userId);
    return {
      tracks: [
        ...mapped,
        {
          id: PERSONAL_TRACK_ID,
          title: personal?.title ?? "Personal",
          description:
            personal?.description ??
            "Your private practice scenarios (visible only to you).",
          sortOrder: personal?.sortOrder ?? 99,
          scenarioCount: mineCount,
          kind: "personal" as const,
        },
      ],
    };
  },

  async listForUser(userId: string, trackId?: string) {
    // Track → Scenario: filtering by personal returns that user's owned scenarios.
    if (trackId === PERSONAL_TRACK_ID) {
      return this.listMine(userId);
    }
    if (trackId) {
      const track = await prisma.track.findUnique({ where: { id: trackId } });
      if (!track || track.id === PERSONAL_TRACK_ID) {
        throw new AppError(404, "NOT_FOUND", "Track not found");
      }
    }
    const scenarios = await scenariosRepository.listGlobalScenarios(trackId);
    const cards = await Promise.all(
      scenarios.map(async (s) => {
        const progress = await userStatusForScenario(userId, s.id);
        return toCard(s, progress);
      }),
    );
    return { scenarios: cards };
  },

  async getById(userId: string, scenarioId: string) {
    const scenario = await scenariosRepository.findById(scenarioId);
    if (!scenario || !canAccessScenario(scenario, userId)) {
      throw new AppError(404, "NOT_FOUND", "Scenario not found");
    }
    const progress = await userStatusForScenario(userId, scenarioId);
    return detailPayload(scenario, progress);
  },

  async listMine(userId: string) {
    const scenarios = await scenariosRepository.listMine(userId);
    const cards = await Promise.all(
      scenarios.map(async (s) => {
        const progress = await userStatusForScenario(userId, s.id);
        return toCard(s, progress);
      }),
    );
    return { scenarios: cards };
  },

  async getMine(userId: string, scenarioId: string) {
    const scenario = await scenariosRepository.findMineById(userId, scenarioId);
    if (!scenario) throw new AppError(404, "NOT_FOUND", "Scenario not found");
    const progress = await userStatusForScenario(userId, scenarioId);
    return detailPayload(scenario, progress);
  },

  async createMine(userId: string, input: ScenarioWriteInput) {
    await ensurePersonalTrack();
    const id = randomUUID();
    const created = await prisma.scenario.create({
      data: {
        id,
        trackId: PERSONAL_TRACK_ID,
        title: input.title,
        description: input.description,
        level: input.level,
        estDurationMin: input.estDurationMin,
        practiceCallMin: input.practiceCallMin,
        points: input.points,
        passMark: input.passMark,
        availability: input.availability ?? "live",
        languages: input.languages,
        voices: input.voices,
        defaultLanguage: input.defaultLanguage,
        defaultVoice: input.defaultVoice,
        learn: input.learn as object,
        watch: input.watch as object,
        ownerUserId: userId,
      },
      include: { track: true },
    });
    const progress = await userStatusForScenario(userId, created.id);
    return detailPayload(created, progress);
  },

  async patchMine(userId: string, scenarioId: string, input: ScenarioWritePatchInput) {
    const existing = await scenariosRepository.findMineById(userId, scenarioId);
    if (!existing) throw new AppError(404, "NOT_FOUND", "Scenario not found");

    // Personal scenarios stay on the personal track.
    const data: Record<string, unknown> = { ...input, trackId: PERSONAL_TRACK_ID };
    delete data.id;
    if (input.learn) data.learn = input.learn as object;
    if (input.watch) data.watch = input.watch as object;
    if (input.languages) data.languages = input.languages;
    if (input.voices) data.voices = input.voices;

    const updated = await prisma.scenario.update({
      where: { id: scenarioId },
      data,
      include: { track: true },
    });
    const progress = await userStatusForScenario(userId, scenarioId);
    return detailPayload(updated, progress);
  },

  async deleteMine(userId: string, scenarioId: string) {
    const existing = await scenariosRepository.findMineById(userId, scenarioId);
    if (!existing) throw new AppError(404, "NOT_FOUND", "Scenario not found");
    const sessions = await prisma.practiceSession.count({ where: { scenarioId } });
    if (sessions > 0) {
      throw new AppError(
        409,
        "VALIDATION_ERROR",
        `Scenario has ${sessions} session(s); set availability to coming_soon instead of deleting`,
      );
    }
    await prisma.scenario.delete({ where: { id: scenarioId } });
    return { ok: true };
  },
};

async function ensurePersonalTrack() {
  await prisma.track.upsert({
    where: { id: PERSONAL_TRACK_ID },
    create: {
      id: PERSONAL_TRACK_ID,
      title: "Personal",
      description: "User-created practice scenarios (private to each learner).",
      sortOrder: 99,
    },
    update: {},
  });
}

function isVoiceInList(id: string, voices: { id: string }[]): boolean {
  return voices.some((v) => v.id === id);
}
