export type LearnForm = {
  situation: string;
  greeting: string;
  participantName: string;
  participantRole: string;
  participantTone: string;
  participantAgenda: string;
  participantGender: "male" | "female";
  objectivesText: string;
  goodLooksText: string;
};

export function slugifyScenarioId(title: string) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base ? `scenario-${base}` : "";
}

function parseLines(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function learnFromForm(f: LearnForm) {
  return {
    situation: f.situation,
    greeting: f.greeting || "Hello, thanks for joining the call.",
    participant: {
      name: f.participantName,
      role: f.participantRole,
      tone: f.participantTone,
      agenda: f.participantAgenda,
      gender: f.participantGender,
    },
    objectives: parseLines(f.objectivesText),
    whatGoodLooksLike: parseLines(f.goodLooksText),
  };
}

export function learnToForm(raw: unknown): LearnForm {
  const learn = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const participant = (learn.participant && typeof learn.participant === "object"
    ? learn.participant
    : {}) as Record<string, unknown>;
  const objectives = Array.isArray(learn.objectives) ? learn.objectives.map(String) : [];
  const good = Array.isArray(learn.whatGoodLooksLike)
    ? learn.whatGoodLooksLike.map(String)
    : [];
  return {
    situation: String(learn.situation ?? ""),
    greeting: String(learn.greeting ?? "Hello, thanks for joining the call."),
    participantName: String(participant.name ?? ""),
    participantRole: String(participant.role ?? ""),
    participantTone: String(participant.tone ?? ""),
    participantAgenda: String(participant.agenda ?? ""),
    participantGender: participant.gender === "female" ? "female" : "male",
    objectivesText: objectives.join("\n"),
    goodLooksText: good.join("\n"),
  };
}

export function emptyLearnForm(): LearnForm {
  return {
    situation: "",
    greeting: "Hello, thanks for joining the call.",
    participantName: "",
    participantRole: "",
    participantTone: "",
    participantAgenda: "",
    participantGender: "male",
    objectivesText: "",
    goodLooksText: "",
  };
}

export const PERSONAL_TRACK_ID = "personal";
export const PERSONAL_TRACK_TITLE = "Personal";
