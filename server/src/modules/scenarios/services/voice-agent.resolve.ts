import type { Scenario, Track } from "@prisma/client";
import type { ScenarioAgentConfig } from "../../sarvam/config/voice.config.js";

type LearnPayload = {
  greeting?: string;
  situation?: string;
  participant?: {
    name?: string;
    role?: string;
    tone?: string;
    agenda?: string;
  };
  whatGoodLooksLike?: string[];
  objectives?: string[];
};

export type ResolvedVoiceAgent = ScenarioAgentConfig & {
  source: "scenario" | "track";
};

/** Hybrid: scenario override wins; otherwise track agent. */
export function resolveVoiceAgent(
  scenario: Scenario & { track: Track },
): ResolvedVoiceAgent | null {
  if (scenario.sarvamAppId && scenario.sarvamOrgId && scenario.sarvamWorkspaceId) {
    return {
      orgId: scenario.sarvamOrgId,
      workspaceId: scenario.sarvamWorkspaceId,
      appId: scenario.sarvamAppId,
      version: scenario.sarvamVersion ?? 1,
      source: "scenario",
    };
  }
  const t = scenario.track;
  if (t.sarvamAppId && t.sarvamOrgId && t.sarvamWorkspaceId) {
    return {
      orgId: t.sarvamOrgId,
      workspaceId: t.sarvamWorkspaceId,
      appId: t.sarvamAppId,
      version: t.sarvamVersion ?? 1,
      source: "track",
    };
  }
  return null;
}

export function buildAgentVariables(
  scenario: Scenario,
): Record<string, string> {
  const learn = (scenario.learn ?? {}) as LearnPayload;
  const participant = learn.participant ?? {};
  const objectives = Array.isArray(learn.objectives) ? learn.objectives : [];
  const good = Array.isArray(learn.whatGoodLooksLike) ? learn.whatGoodLooksLike : [];

  return {
    scenario_id: scenario.id,
    scenario_title: scenario.title,
    scenario_description: scenario.description,
    scenario_level: scenario.level,
    situation: learn.situation ?? "",
    participant_name: participant.name ?? "Coach",
    participant_role: participant.role ?? "",
    participant_tone: participant.tone ?? "",
    participant_agenda: participant.agenda ?? "",
    objectives: objectives.map((o, i) => `${i + 1}. ${o}`).join("\n"),
    what_good_looks_like: good.map((o, i) => `${i + 1}. ${o}`).join("\n"),
    // Fixed opener for all scenarios (matches Indus agent Greeting).
    greeting: "Hello, thanks for joining the call.",
  };
}

export function canPracticeScenario(scenario: Scenario & { track: Track }): boolean {
  if (scenario.availability !== "live") return false;
  return resolveVoiceAgent(scenario) !== null;
}
