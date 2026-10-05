import { prisma } from "../../../shared/db/prisma.js";

export const promptsRepository = {
  /**
   * Resolve scoring system prompt:
   * scenario-specific → track fallback → default.
   */
  async getScoringSystem(trackId: string, scenarioId?: string): Promise<string> {
    if (scenarioId) {
      const byScenario = await prisma.prompt.findFirst({
        where: { kind: "scoring_system", scenarioId },
      });
      if (byScenario?.body) return byScenario.body;
    }

    const byTrack = await prisma.prompt.findFirst({
      where: { kind: "scoring_system", trackId, scenarioId: null },
    });
    if (byTrack?.body) return byTrack.body;

    const fallback = await prisma.prompt.findFirst({
      where: { kind: "scoring_system", trackId: null, scenarioId: null },
    });
    if (!fallback?.body) {
      throw new Error(
        `Missing scoring_system prompt for track=${trackId} scenario=${scenarioId ?? "-"}`,
      );
    }
    return fallback.body;
  },

  async getScoringUserTemplate(): Promise<string> {
    const row = await prisma.prompt.findFirst({
      where: { kind: "scoring_user" },
      orderBy: { id: "asc" },
    });
    if (!row?.body) {
      throw new Error("Missing scoring_user prompt template");
    }
    return row.body;
  },

  async getVoiceAgent(trackId: string): Promise<string | null> {
    const row = await prisma.prompt.findFirst({
      where: { kind: "voice_agent", trackId },
    });
    return row?.body ?? null;
  },
};
