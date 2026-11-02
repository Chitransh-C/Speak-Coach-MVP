import bcrypt from "bcryptjs";
import { prisma } from "../../../shared/db/prisma.js";
import { env } from "../../../shared/config/env.js";
import { AppError } from "../../../shared/http/errors.js";
import { logger } from "../../../shared/logging/logger.js";
import { listLanguages, listVoices } from "../../../shared/catalog/locale.js";
import { scoringService } from "../../scoring/services/scoring.service.js";
import type {
  PatchUserInput,
  PromptPatchInput,
  ScenarioCreateInput,
  ScenarioPatchInput,
  TrackCreateInput,
  TrackPatchInput,
} from "../schemas/admin.schemas.js";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function audit(adminId: string, action: string, entity: string, meta?: unknown) {
  logger.info("admin_mutation", { adminId, action, entity, meta });
}

export const adminService = {
  async stats() {
    const since7 = daysAgo(7);
    const since30 = daysAgo(30);

    const [
      usersTotal,
      usersNew7d,
      sessionsTotal,
      sessions7d,
      completed7d,
      failed7d,
      scores7d,
      durationAgg,
      topScenarios,
      recentFailed,
      sessionsByDayRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      prisma.practiceSession.count(),
      prisma.practiceSession.count({ where: { createdAt: { gte: since7 } } }),
      prisma.practiceSession.count({
        where: { createdAt: { gte: since7 }, status: "completed" },
      }),
      prisma.practiceSession.count({
        where: { createdAt: { gte: since7 }, status: "failed" },
      }),
      prisma.score.findMany({
        where: { createdAt: { gte: since7 } },
        select: { overall: true, passed: true },
      }),
      prisma.practiceSession.aggregate({
        where: { createdAt: { gte: since7 }, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      prisma.practiceSession.groupBy({
        by: ["scenarioId"],
        where: { createdAt: { gte: since30 } },
        _count: { scenarioId: true },
        orderBy: { _count: { scenarioId: "desc" } },
        take: 8,
      }),
      prisma.score.findMany({
        where: { passed: false },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          session: {
            select: {
              id: true,
              scenarioId: true,
              user: { select: { email: true, displayName: true } },
              scenario: { select: { title: true } },
            },
          },
        },
      }),
      prisma.practiceSession.findMany({
        where: { createdAt: { gte: since30 } },
        select: { createdAt: true },
      }),
    ]);

    const passRate7d =
      scores7d.length > 0
        ? Math.round((scores7d.filter((s) => s.passed).length / scores7d.length) * 100)
        : null;
    const avgScore7d =
      scores7d.length > 0
        ? Math.round(scores7d.reduce((a, s) => a + s.overall, 0) / scores7d.length)
        : null;

    const scenarioMeta = await prisma.scenario.findMany({
      where: { id: { in: topScenarios.map((t) => t.scenarioId) } },
      select: { id: true, title: true },
    });
    const titleById = Object.fromEntries(scenarioMeta.map((s) => [s.id, s.title]));

    const dayBuckets = new Map<string, number>();
    for (const s of sessionsByDayRaw) {
      const key = s.createdAt.toISOString().slice(0, 10);
      dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + 1);
    }
    const sessionsOverTime = [...dayBuckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return {
      kpis: {
        usersTotal,
        usersNew7d,
        sessionsTotal,
        sessions7d,
        completed7d,
        failed7d,
        passRate7d,
        avgScore7d,
        avgDurationMs7d: durationAgg._avg.durationMs
          ? Math.round(durationAgg._avg.durationMs)
          : null,
      },
      topScenarios: topScenarios.map((t) => ({
        scenarioId: t.scenarioId,
        title: titleById[t.scenarioId] ?? t.scenarioId,
        count: t._count.scenarioId,
      })),
      recentFailed: recentFailed.map((s) => ({
        sessionId: s.session.id,
        overall: s.overall,
        scenarioTitle: s.session.scenario.title,
        userEmail: s.session.user.email,
        userName: s.session.user.displayName,
        createdAt: s.createdAt,
      })),
      sessionsOverTime,
      system: {
        voiceProvider: "gemini",
        chatProvider: env.CHAT_PROVIDER,
        voiceModel: env.GEMINI_VOICE_MODEL,
        chatModel: env.GEMINI_CHAT_MODEL,
        geminiKeyConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
      },
    };
  },

  async health() {
    let dbOk = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return {
      ok: dbOk,
      dbOk,
      geminiKeyConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
      chatProvider: env.CHAT_PROVIDER,
      voiceModel: env.GEMINI_VOICE_MODEL,
      chatModel: env.GEMINI_CHAT_MODEL,
      locales: {
        languages: listLanguages().length,
        voices: listVoices().length,
      },
    };
  },

  async listUsers(query: { q?: string; role?: string }) {
    const where: Record<string, unknown> = {};
    if (query.role === "admin" || query.role === "learner") where.role = query.role;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { email: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabledAt: true,
        createdAt: true,
        _count: { select: { sessions: true } },
      },
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        disabled: Boolean(u.disabledAt),
        createdAt: u.createdAt,
        sessionCount: u._count.sessions,
      })),
    };
  },

  async getUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabledAt: true,
        createdAt: true,
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            scenarioId: true,
            status: true,
            language: true,
            createdAt: true,
            durationMs: true,
            scenario: { select: { title: true } },
            score: { select: { overall: true, passed: true } },
          },
        },
      },
    });
    if (!user) throw new AppError(404, "NOT_FOUND", "User not found");
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      disabled: Boolean(user.disabledAt),
      createdAt: user.createdAt,
      sessions: user.sessions.map((s) => ({
        id: s.id,
        scenarioId: s.scenarioId,
        scenarioTitle: s.scenario.title,
        status: s.status,
        language: s.language,
        createdAt: s.createdAt,
        durationMs: s.durationMs,
        score: s.score,
      })),
    };
  },

  async patchUser(adminId: string, id: string, input: PatchUserInput) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, "NOT_FOUND", "User not found");

    const data: {
      role?: string;
      displayName?: string;
      disabledAt?: Date | null;
      passwordHash?: string;
    } = {};
    if (input.role) data.role = input.role;
    if (input.displayName) data.displayName = input.displayName;
    if (typeof input.disabled === "boolean") {
      data.disabledAt = input.disabled ? new Date() : null;
    }
    if (input.tempPassword) {
      data.passwordHash = await bcrypt.hash(input.tempPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        disabledAt: true,
        createdAt: true,
      },
    });
    audit(adminId, "user.patch", id, {
      role: input.role,
      disabled: input.disabled,
      passwordReset: Boolean(input.tempPassword),
    });
    return {
      id: updated.id,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      disabled: Boolean(updated.disabledAt),
      createdAt: updated.createdAt,
    };
  },

  async listTracks() {
    const tracks = await prisma.track.findMany({
      where: { id: { not: "personal" } },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { scenarios: { where: { ownerUserId: null } } } } },
    });
    return {
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        sortOrder: t.sortOrder,
        scenarioCount: t._count.scenarios,
        updatedAt: t.updatedAt,
      })),
    };
  },

  async createTrack(adminId: string, input: TrackCreateInput) {
    if (input.id === "personal") {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Track id 'personal' is reserved for learner-owned scenarios",
      );
    }
    const existing = await prisma.track.findUnique({ where: { id: input.id } });
    if (existing) throw new AppError(409, "VALIDATION_ERROR", "Track id already exists");
    const track = await prisma.track.create({
      data: {
        id: input.id,
        title: input.title,
        description: input.description,
        sortOrder: input.sortOrder,
      },
    });
    audit(adminId, "track.create", track.id);
    return track;
  },

  async patchTrack(adminId: string, id: string, input: TrackPatchInput) {
    if (id === "personal") {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot edit the reserved personal track here");
    }
    const existing = await prisma.track.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Track not found");
    const track = await prisma.track.update({ where: { id }, data: input });
    audit(adminId, "track.patch", id, input);
    return track;
  },

  async deleteTrack(adminId: string, id: string) {
    if (id === "personal") {
      throw new AppError(400, "VALIDATION_ERROR", "Cannot delete the reserved personal track");
    }
    const count = await prisma.scenario.count({ where: { trackId: id } });
    if (count > 0) {
      throw new AppError(
        409,
        "VALIDATION_ERROR",
        `Track has ${count} scenario(s); remove or reassign them first`,
      );
    }
    await prisma.track.delete({ where: { id } });
    audit(adminId, "track.delete", id);
    return { ok: true };
  },

  async listScenarios(query: { trackId?: string; availability?: string }) {
    const where: Record<string, unknown> = { ownerUserId: null };
    if (query.trackId) where.trackId = query.trackId;
    if (query.availability) where.availability = query.availability;
    const scenarios = await prisma.scenario.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { track: { select: { title: true } } },
    });
    return {
      scenarios: scenarios.map((s) => ({
        id: s.id,
        trackId: s.trackId,
        trackTitle: s.track.title,
        title: s.title,
        description: s.description,
        level: s.level,
        estDurationMin: s.estDurationMin,
        practiceCallMin: s.practiceCallMin,
        points: s.points,
        passMark: s.passMark,
        availability: s.availability,
        defaultLanguage: s.defaultLanguage,
        defaultVoice: s.defaultVoice,
        updatedAt: s.updatedAt,
      })),
    };
  },

  async getScenario(id: string) {
    const s = await prisma.scenario.findFirst({
      where: { id, ownerUserId: null },
      include: { track: { select: { title: true } } },
    });
    if (!s) throw new AppError(404, "NOT_FOUND", "Scenario not found");
    return {
      ...s,
      trackTitle: s.track.title,
      languages: s.languages,
      voices: s.voices,
      learn: s.learn,
      watch: s.watch,
    };
  },

  async createScenario(adminId: string, input: ScenarioCreateInput) {
    if (input.trackId === "personal") {
      throw new AppError(400, "VALIDATION_ERROR", "Use a catalog track for global scenarios");
    }
    const track = await prisma.track.findUnique({ where: { id: input.trackId } });
    if (!track) throw new AppError(400, "VALIDATION_ERROR", "Unknown trackId");
    const existing = await prisma.scenario.findUnique({ where: { id: input.id } });
    if (existing) throw new AppError(409, "VALIDATION_ERROR", "Scenario id already exists");
    const created = await prisma.scenario.create({
      data: {
        id: input.id,
        trackId: input.trackId,
        title: input.title,
        description: input.description,
        level: input.level,
        estDurationMin: input.estDurationMin,
        practiceCallMin: input.practiceCallMin,
        points: input.points,
        passMark: input.passMark,
        availability: input.availability,
        languages: input.languages,
        voices: input.voices,
        defaultLanguage: input.defaultLanguage,
        defaultVoice: input.defaultVoice,
        learn: input.learn as object,
        watch: input.watch as object,
        ownerUserId: null,
      },
    });
    audit(adminId, "scenario.create", created.id);
    return created;
  },

  async patchScenario(adminId: string, id: string, input: ScenarioPatchInput) {
    const existing = await prisma.scenario.findFirst({ where: { id, ownerUserId: null } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Scenario not found");
    if (input.trackId) {
      if (input.trackId === "personal") {
        throw new AppError(400, "VALIDATION_ERROR", "Cannot move global scenario to personal track");
      }
      const track = await prisma.track.findUnique({ where: { id: input.trackId } });
      if (!track) throw new AppError(400, "VALIDATION_ERROR", "Unknown trackId");
    }
    const data: Record<string, unknown> = { ...input };
    if (input.learn) data.learn = input.learn as object;
    if (input.watch) data.watch = input.watch as object;
    if (input.languages) data.languages = input.languages;
    if (input.voices) data.voices = input.voices;
    const updated = await prisma.scenario.update({ where: { id }, data });
    audit(adminId, "scenario.patch", id, Object.keys(input));
    return updated;
  },

  async deleteScenario(adminId: string, id: string) {
    const existing = await prisma.scenario.findFirst({ where: { id, ownerUserId: null } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Scenario not found");
    const sessions = await prisma.practiceSession.count({ where: { scenarioId: id } });
    if (sessions > 0) {
      throw new AppError(
        409,
        "VALIDATION_ERROR",
        `Scenario has ${sessions} session(s); set availability to coming_soon instead of deleting`,
      );
    }
    await prisma.scenario.delete({ where: { id } });
    audit(adminId, "scenario.delete", id);
    return { ok: true };
  },

  async listPrompts(query: { kind?: string; trackId?: string }) {
    const where: Record<string, unknown> = {};
    if (query.kind) where.kind = query.kind;
    if (query.trackId) where.trackId = query.trackId;
    const prompts = await prisma.prompt.findMany({
      where,
      orderBy: [{ kind: "asc" }, { trackId: "asc" }, { scenarioId: "asc" }],
    });
    return { prompts };
  },

  async getPrompt(id: string) {
    const prompt = await prisma.prompt.findUnique({ where: { id } });
    if (!prompt) throw new AppError(404, "NOT_FOUND", "Prompt not found");
    return prompt;
  },

  async patchPrompt(adminId: string, id: string, input: PromptPatchInput) {
    const existing = await prisma.prompt.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Prompt not found");
    const prompt = await prisma.prompt.update({
      where: { id },
      data: {
        body: input.body,
        ...(input.title !== undefined ? { title: input.title } : {}),
      },
    });
    audit(adminId, "prompt.patch", id);
    return prompt;
  },

  async listSessions(query: {
    q?: string;
    scenarioId?: string;
    status?: string;
    language?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (query.scenarioId) where.scenarioId = query.scenarioId;
    if (query.status) where.status = query.status;
    if (query.language) where.language = query.language;
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { displayName: { contains: q, mode: "insensitive" } } },
        { scenario: { title: { contains: q, mode: "insensitive" } } },
      ];
    }
    const sessions = await prisma.practiceSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, displayName: true } },
        scenario: { select: { id: true, title: true } },
        score: { select: { overall: true, passed: true } },
      },
    });
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        language: s.language,
        voice: s.voice,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMs: s.durationMs,
        user: s.user,
        scenario: s.scenario,
        score: s.score,
      })),
    };
  },

  async getSession(id: string) {
    const session = await prisma.practiceSession.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, displayName: true, role: true } },
        scenario: { select: { id: true, title: true, trackId: true, passMark: true } },
        transcript: true,
        score: true,
        latencyEvents: { orderBy: { atMs: "asc" } },
      },
    });
    if (!session) throw new AppError(404, "NOT_FOUND", "Session not found");
    return session;
  },

  async rescoreSession(adminId: string, id: string) {
    const session = await prisma.practiceSession.findUnique({
      where: { id },
      include: {
        transcript: true,
        scenario: { select: { id: true, title: true, trackId: true, passMark: true } },
      },
    });
    if (!session) throw new AppError(404, "NOT_FOUND", "Session not found");
    const turns = (session.transcript?.turns as
      | { speaker: string; text: string; startedAtMs?: number; endedAtMs?: number }[]
      | null) ?? [];
    if (!turns.length) {
      throw new AppError(422, "VALIDATION_ERROR", "Session has no transcript to score");
    }
    const result = await scoringService.scoreSession(
      id,
      turns,
      session.scenario.passMark,
      session.scenario.trackId,
      { id: session.scenario.id, title: session.scenario.title },
    );
    if (result.insufficient) {
      await prisma.practiceSession.update({
        where: { id },
        data: { status: "failed" },
      });
      audit(adminId, "session.rescore_insufficient", id);
      throw new AppError(422, "INSUFFICIENT_TRANSCRIPT", "Transcript still insufficient to score");
    }
    await prisma.practiceSession.update({
      where: { id },
      data: { status: "completed" },
    });
    audit(adminId, "session.rescore", id, { overall: result.score?.overall });
    return { sessionId: id, status: "completed" as const, score: result.score };
  },

  locales() {
    return {
      languages: listLanguages(),
      voices: listVoices(),
    };
  },
};
