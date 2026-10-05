import type { Scenario } from "@prisma/client";
import { prisma } from "../../../shared/db/prisma.js";

export const scenariosRepository = {
  listTracks() {
    return prisma.track.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { scenarios: true } } },
    });
  },

  listScenarios(trackId?: string) {
    return prisma.scenario.findMany({
      where: trackId ? { trackId } : undefined,
      orderBy: [{ trackId: "asc" }, { id: "asc" }],
      include: { track: true },
    });
  },

  findById(id: string) {
    return prisma.scenario.findUnique({
      where: { id },
      include: { track: true },
    });
  },
};

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
