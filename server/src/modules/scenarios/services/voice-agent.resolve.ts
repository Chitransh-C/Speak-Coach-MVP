import type { Scenario, Track } from "@prisma/client";

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

/** Scenario fields injected into the Gemini Live system instruction. */
export function buildAgentVariables(scenario: Scenario): Record<string, string> {
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
    greeting: "Hello, thanks for joining the call.",
  };
}

export function canPracticeScenario(scenario: Scenario & { track: Track }): boolean {
  // Gemini Live uses scenario prompts — no third-party agent ids required.
  return scenario.availability === "live";
}
