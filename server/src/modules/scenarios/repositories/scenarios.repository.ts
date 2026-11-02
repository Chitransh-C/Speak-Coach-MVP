import type { Scenario } from "@prisma/client";
import { prisma } from "../../../shared/db/prisma.js";

export const PERSONAL_TRACK_ID = "personal";

export const scenariosRepository = {
  /** Catalog tracks only (Interviews, Sales, …) — never the personal bucket. */
  listCatalogTracks() {
    return prisma.track.findMany({
      where: { id: { not: PERSONAL_TRACK_ID } },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { scenarios: { where: { ownerUserId: null } } } } },
    });
  },

  findPersonalTrack() {
    return prisma.track.findUnique({ where: { id: PERSONAL_TRACK_ID } });
  },

  countMine(userId: string) {
    return prisma.scenario.count({ where: { ownerUserId: userId } });
  },

  /** Global catalog only (`ownerUserId` null). */
  listGlobalScenarios(trackId?: string) {
    return prisma.scenario.findMany({
      where: {
        ownerUserId: null,
        ...(trackId ? { trackId } : {}),
        ...(trackId ? {} : { trackId: { not: PERSONAL_TRACK_ID } }),
      },
      orderBy: [{ trackId: "asc" }, { id: "asc" }],
      include: { track: true },
    });
  },

  listMine(userId: string) {
    return prisma.scenario.findMany({
      where: { ownerUserId: userId, trackId: PERSONAL_TRACK_ID },
      orderBy: { updatedAt: "desc" },
      include: { track: true },
    });
  },

  findById(id: string) {
    return prisma.scenario.findUnique({
      where: { id },
      include: { track: true },
    });
  },

  findMineById(userId: string, id: string) {
    return prisma.scenario.findFirst({
      where: { id, ownerUserId: userId },
      include: { track: true },
    });
  },
};

/** Visible if global or owned by the user. */
export function canAccessScenario(
  scenario: { ownerUserId: string | null },
  userId: string,
): boolean {
  return scenario.ownerUserId == null || scenario.ownerUserId === userId;
}

/** Practice allowed if live and (global or owned). */
export function canPracticeOwnedScenario(
  scenario: { ownerUserId: string | null; availability: string },
  userId: string,
): boolean {
  if (scenario.availability !== "live") return false;
  return canAccessScenario(scenario, userId);
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function participantName(scenario: Scenario): string {
  const learn = scenario.learn as { participant?: { name?: string } } | null;
  return learn?.participant?.name?.trim() || "Agent";
}

export function participantGender(scenario: Scenario): "male" | "female" {
  const learn = scenario.learn as { participant?: { gender?: string } } | null;
  return learn?.participant?.gender === "female" ? "female" : "male";
}
