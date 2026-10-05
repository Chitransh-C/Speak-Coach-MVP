import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildScenarioScoringPrompt, SEED_PROMPTS } from "./prompt-content.js";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Shared org/workspace from current Sarvam / Indus account. */
const ORG = "01a10b46-c948-764c-97a1-b2b72a88470d";
const WORKSPACE = "01a10b46-c953-7fee-8018-bd18dfe8d310";
/**
 * Interviews track: variable-driven SpeakCoach Interviews agent
 * (replaces persona-hardcoded Alex Rivera).
 */
const INTERVIEWS_APP = "SpeakCoach--2af8ce6a-b04b";
const INTERVIEWS_VERSION = 2;
/**
 * Sales track: SpeakCoach Sales buyer uses {{ variables }} — multiple scenarios share one agent.
 */
const SALES_APP: string | null = "SpeakCoach--e8102ca0-0c25";
const SALES_VERSION = 2;

type Learn = {
  greeting: string;
  situation: string;
  participant: {
    name: string;
    role: string;
    tone: string;
    agenda: string;
    gender: "male" | "female";
  };
  whatGoodLooksLike: string[];
  objectives: string[];
};

type SeedScenario = {
  id: string;
  trackId: "interviews" | "sales";
  title: string;
  description: string;
  level: string;
  estDurationMin: number;
  practiceCallMin: number;
  points: number;
  passMark: number;
  learn: Learn;
  watch: { turns: { speaker: string; text: string }[] };
};

function salesScenario(
  partial: Omit<SeedScenario, "trackId" | "points" | "passMark"> & {
    points?: number;
    passMark?: number;
  },
): SeedScenario {
  return {
    trackId: "sales",
    points: 100,
    passMark: 70,
    ...partial,
  };
}

async function main() {
  // Catalog policy: exactly two tracks — interviews + sales.
  await prisma.scenario.deleteMany({
    where: { trackId: { notIn: ["interviews", "sales"] } },
  });
  await prisma.track.deleteMany({
    where: { id: { notIn: ["interviews", "sales"] } },
  });
  // Interviews = one scenario only (Alex is hardcoded).
  await prisma.scenario.deleteMany({
    where: { trackId: "interviews", id: { not: "scenario-001" } },
  });

  await prisma.track.upsert({
    where: { id: "interviews" },
    create: {
      id: "interviews",
      title: "Interviews",
      description:
        "Interview practice — one Voice Agent with {{ variables }} per scenario (SpeakCoach Interviews).",
      sortOrder: 1,
      sarvamOrgId: ORG,
      sarvamWorkspaceId: WORKSPACE,
      sarvamAppId: INTERVIEWS_APP,
      sarvamVersion: INTERVIEWS_VERSION,
    },
    update: {
      title: "Interviews",
      description:
        "Interview practice — one Voice Agent with {{ variables }} per scenario (SpeakCoach Interviews).",
      sortOrder: 1,
      sarvamOrgId: ORG,
      sarvamWorkspaceId: WORKSPACE,
      sarvamAppId: INTERVIEWS_APP,
      sarvamVersion: INTERVIEWS_VERSION,
    },
  });

  await prisma.track.upsert({
    where: { id: "sales" },
    create: {
      id: "sales",
      title: "Sales",
      description:
        "Buyer role-play via one Sales Voice Agent; each scenario injects different {{ variables }}.",
      sortOrder: 2,
      sarvamOrgId: ORG,
      sarvamWorkspaceId: WORKSPACE,
      sarvamAppId: SALES_APP,
      sarvamVersion: SALES_APP ? SALES_VERSION : null,
    },
    update: {
      title: "Sales",
      description:
        "Buyer role-play via one Sales Voice Agent; each scenario injects different {{ variables }}.",
      sortOrder: 2,
      sarvamOrgId: ORG,
      sarvamWorkspaceId: WORKSPACE,
      ...(SALES_APP ? { sarvamAppId: SALES_APP, sarvamVersion: SALES_VERSION } : {}),
    },
  });

  const rawPath = resolve(__dirname, "../content/scenario-001.json");
  if (!existsSync(rawPath)) {
    throw new Error(
      `Missing seed content file: ${rawPath}. Deploy must include server/content/ and server/prisma/.`,
    );
  }
  const file = JSON.parse(readFileSync(rawPath, "utf8")) as {
    id: string;
    title: string;
    description: string;
    level: string;
    estDurationMin: number;
    practiceCallMin: number;
    points: number;
    passMark: number;
    learn: Learn;
    watch: SeedScenario["watch"];
  };
  const learn001: Learn = {
    ...file.learn,
    greeting:
      "Thanks for joining today. I'm Alex Rivera, the hiring manager. To start — tell me about yourself.",
    participant: {
      ...file.learn.participant,
      gender: "male",
    },
  };

  await upsertScenario({
    id: "scenario-001",
    trackId: "interviews",
    title: file.title,
    description: file.description,
    level: file.level,
    estDurationMin: file.estDurationMin,
    practiceCallMin: file.practiceCallMin,
    points: file.points,
    passMark: file.passMark,
    learn: learn001,
    watch: file.watch,
  });

  const salesLive = Boolean(SALES_APP);
  const salesScenarios: SeedScenario[] = [
    salesScenario({
      id: "scenario-sales-001",
      title: "Sales Discovery: Uncover the Pain",
      description: "Open a discovery call, probe pain, and book a clear next step — no feature dump.",
      level: "beginner",
      estDurationMin: 12,
      practiceCallMin: 6,
      learn: {
        greeting:
          "Hi — thanks for making time. Before we talk product, what's the biggest challenge on your plate this quarter?",
        situation:
          "You are an AE on a discovery call with a mid-market buyer. Goal: understand pain, quantify impact, and secure a next step — not pitch features yet.",
        participant: {
          name: "Morgan Hale",
          role: "Buyer · Director of Operations",
          tone: "Busy, skeptical but fair",
          agenda: "See if this vendor understands the problem before entertaining a demo",
          gender: "female",
        },
        whatGoodLooksLike: [
          "Opens with context, not a product dump",
          "Asks open questions about pain and impact",
          "Reflects back what the buyer said",
          "Proposes a concrete next step",
        ],
        objectives: [
          "Uncover at least one concrete pain early",
          "Quantify impact if possible (time, money, risk)",
          "Close with a clear next step",
        ],
      },
      watch: {
        turns: [
          { speaker: "Buyer", text: "I've got ten minutes. What is this about?" },
          {
            speaker: "Learner",
            text: "Appreciate the time. Before I share anything — what's eating the most time for your team this quarter?",
          },
          {
            speaker: "Buyer",
            text: "Honestly, rebuilding the same weekly deck. Two analysts, half a day each.",
          },
          {
            speaker: "Learner",
            text: "Got it — roughly a day a week lost to deck assembly. If we could cut that in half, would a short walkthrough with your ops lead next week be worth it?",
          },
        ],
      },
    }),
    salesScenario({
      id: "scenario-sales-002",
      title: "Price Objection: Hold Value",
      description: "Buyer pushes on price. Defend value without discounting too early.",
      level: "intermediate",
      estDurationMin: 12,
      practiceCallMin: 6,
      learn: {
        greeting:
          "I'll be direct — your pricing looks high versus what we're seeing elsewhere. Why should we pay a premium?",
        situation:
          "Mid-funnel call. The buyer likes the product but is pressure-testing price and comparing you to a cheaper alternative.",
        participant: {
          name: "Priya Nair",
          role: "Buyer · VP Procurement",
          tone: "Direct, numbers-focused, slightly impatient",
          agenda: "Extract concession or prove ROI before advancing to legal review",
          gender: "female",
        },
        whatGoodLooksLike: [
          "Acknowledges the concern without collapsing",
          "Reframes to outcomes / risk avoided",
          "Asks what 'good enough' ROI looks like",
          "Avoids an immediate blind discount",
        ],
        objectives: [
          "Handle the price pushback calmly",
          "Anchor on value and impact",
          "Propose a next step that isn't 'I'll ask for a discount'",
        ],
      },
      watch: {
        turns: [
          {
            speaker: "Buyer",
            text: "You're 30% above the other vendor. Why would we pay that?",
          },
          {
            speaker: "Learner",
            text: "Fair question. The gap usually comes from implementation risk — teams that choose the cheaper option often spend two quarters rebuilding reporting. What cost does a delayed rollout carry for you?",
          },
        ],
      },
    }),
    salesScenario({
      id: "scenario-sales-003",
      title: "Champion Check: Multi-Stakeholder",
      description: "Your champion is friendly, but the economic buyer is cold. Navigate both.",
      level: "intermediate",
      estDurationMin: 14,
      practiceCallMin: 7,
      learn: {
        greeting:
          "I'm looping in our CFO for five minutes. Keep it tight — we've got a board meeting Friday.",
        situation:
          "You previously sold the idea to a champion. Now the economic buyer joins briefly and wants risk, spend, and timeline — not features.",
        participant: {
          name: "Sam Ortega",
          role: "Buyer · CFO (economic buyer on the line)",
          tone: "Curt, risk-aware, time-boxed",
          agenda: "Decide whether this is worth budget this quarter or defer",
          gender: "male",
        },
        whatGoodLooksLike: [
          "Leads with business outcome and timeline",
          "Names risk and mitigation briefly",
          "Does not oversell features to a CFO",
          "Asks a crisp decision / next-step question",
        ],
        objectives: [
          "Brief the economic buyer in under two minutes of speaking",
          "Surface one risk and how you handle it",
          "Secure a clear go / no-go next step",
        ],
      },
      watch: {
        turns: [
          {
            speaker: "Buyer",
            text: "Skip the demo. What's the spend and what breaks if we wait a quarter?",
          },
          {
            speaker: "Learner",
            text: "Annual contract is in the range we shared with ops. Waiting a quarter keeps the manual reporting burn — about a day per week — and delays the board metrics you asked for. The risk we manage is a two-week pilot before full rollout.",
          },
        ],
      },
    }),
    salesScenario({
      id: "scenario-sales-004",
      title: "Demo Wrap: Book the Close Path",
      description: "After a product walkthrough, turn interest into a concrete close path.",
      level: "beginner",
      estDurationMin: 11,
      practiceCallMin: 5,
      learn: {
        greeting:
          "Okay, that walkthrough was useful. I'm not ready to buy today — what do you actually need from us next?",
        situation:
          "Post-demo call. The buyer is interested but vague. Your job is to propose a clear mutual action plan.",
        participant: {
          name: "Chris Adeyemi",
          role: "Buyer · Head of Customer Success",
          tone: "Warm, noncommittal, polite",
          agenda: "Stay open without committing budget before internal alignment",
          gender: "male",
        },
        whatGoodLooksLike: [
          "Summarizes value heard from the buyer",
          "Proposes a specific next meeting with owners",
          "Clarifies decision criteria and timeline",
          "Avoids 'I'll send over some info' as the only close",
        ],
        objectives: [
          "Recap pain + value in one tight summary",
          "Propose a dated next step with stakeholders",
          "Confirm what would block a yes",
        ],
      },
      watch: {
        turns: [
          {
            speaker: "Buyer",
            text: "Interesting stuff. Can you email me the deck?",
          },
          {
            speaker: "Learner",
            text: "Happy to. Before I do — if the deck lands well, who else needs to see a 20-minute working session next week so we can pressure-test fit?",
          },
        ],
      },
    }),
    salesScenario({
      id: "scenario-sales-005",
      title: "Renewal Risk: Save the Account",
      description: "Customer is frustrated and considering churn. Diagnose and recover.",
      level: "advanced",
      estDurationMin: 14,
      practiceCallMin: 7,
      learn: {
        greeting:
          "I'm going to be blunt — adoption is low and my team is tired of workarounds. Why shouldn't we switch?",
        situation:
          "Renewal conversation. The buyer is frustrated with onboarding and value realization. You must listen, own gaps, and propose a recovery plan.",
        participant: {
          name: "Elena Voss",
          role: "Buyer · Existing customer · VP RevOps",
          tone: "Frustrated, fair if respected, ready to escalate",
          agenda: "Decide renew vs switch; wants accountability and a plan",
          gender: "female",
        },
        whatGoodLooksLike: [
          "Listens fully before defending",
          "Owns specific gaps without over-apologizing",
          "Proposes a time-bound recovery plan",
          "Asks what success in 30 days would look like",
        ],
        objectives: [
          "Let the buyer air the core frustration",
          "Name two concrete recovery actions with owners/dates",
          "Agree on a check-in before renewal decision",
        ],
      },
      watch: {
        turns: [
          {
            speaker: "Buyer",
            text: "We were promised time-to-value in 30 days. We're at day 90 and still exporting CSVs.",
          },
          {
            speaker: "Learner",
            text: "That's on us. I'd like to put a named CSM and a data engineer on a two-week fix for the export path, then review metrics with you on a fixed Friday. What would 'good' look like at that checkpoint?",
          },
        ],
      },
    }),
  ];

  for (const s of salesScenarios) {
    await upsertScenario(s, salesLive ? "live" : "coming_soon");
  }

  // Drop any leftover sales scenarios not in the five.
  const keepSales = salesScenarios.map((s) => s.id);
  await prisma.scenario.deleteMany({
    where: { trackId: "sales", id: { notIn: keepSales } },
  });

  const scenarioPrompts = [
    buildScenarioScoringPrompt({
      id: "scenario-001",
      trackId: "interviews",
      title: file.title,
      description: file.description,
      level: file.level,
      passMark: file.passMark,
      learn: learn001,
    }),
    ...salesScenarios.map((s) =>
      buildScenarioScoringPrompt({
        id: s.id,
        trackId: "sales",
        title: s.title,
        description: s.description,
        level: s.level,
        passMark: s.passMark,
        learn: s.learn,
      }),
    ),
  ];

  const allPrompts = [...SEED_PROMPTS, ...scenarioPrompts];
  // Drop stale scenario scoring rows not in this seed set.
  await prisma.prompt.deleteMany({
    where: {
      kind: "scoring_system",
      scenarioId: { not: null, notIn: scenarioPrompts.map((p) => p.scenarioId!).filter(Boolean) },
    },
  });

  for (const p of allPrompts) {
    await prisma.prompt.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        kind: p.kind,
        trackId: p.trackId,
        scenarioId: p.scenarioId ?? null,
        title: p.title,
        body: p.body,
      },
      update: {
        kind: p.kind,
        trackId: p.trackId,
        scenarioId: p.scenarioId ?? null,
        title: p.title,
        body: p.body,
      },
    });
  }

  const trackCount = await prisma.track.count();
  const scenarioCount = await prisma.scenario.count();
  const promptCount = await prisma.prompt.count();
  const scenarioScoringCount = await prisma.prompt.count({
    where: { kind: "scoring_system", scenarioId: { not: null } },
  });
  const expectedScenarioScoring = 1 + salesScenarios.length;
  if (trackCount < 2) throw new Error(`Seed incomplete: expected >=2 tracks, got ${trackCount}`);
  if (scenarioCount < expectedScenarioScoring) {
    throw new Error(
      `Seed incomplete: expected >=${expectedScenarioScoring} scenarios, got ${scenarioCount}`,
    );
  }
  if (scenarioScoringCount < expectedScenarioScoring) {
    throw new Error(
      `Seed incomplete: expected ${expectedScenarioScoring} scenario scoring prompts, got ${scenarioScoringCount}`,
    );
  }
  const requiredKinds = ["scoring_user", "voice_agent"] as const;
  for (const kind of requiredKinds) {
    const n = await prisma.prompt.count({ where: { kind } });
    if (n < 1) throw new Error(`Seed incomplete: missing prompts kind=${kind}`);
  }

  console.log(
    `Seed complete: tracks=${trackCount}, scenarios=${scenarioCount}, prompts=${promptCount} ` +
      `(scenario scoring=${scenarioScoringCount})${salesLive ? ", sales live" : ", sales coming_soon"}`,
  );
}

async function upsertScenario(
  s: SeedScenario,
  availability: "live" | "coming_soon" = "live",
) {
  const gender = s.learn.participant.gender;
  const defaultVoice = gender === "female" ? "priya" : "shubh";
  const base = {
    trackId: s.trackId,
    title: s.title,
    description: s.description,
    level: s.level,
    estDurationMin: s.estDurationMin,
    practiceCallMin: s.practiceCallMin,
    points: s.points,
    passMark: s.passMark,
    availability,
    // Languages/voices are central (GET /api/v1/locales); keep empty arrays in DB.
    languages: [] as string[],
    voices: [] as string[],
    defaultLanguage: "en-IN",
    defaultVoice,
    sarvamOrgId: null as string | null,
    sarvamWorkspaceId: null as string | null,
    sarvamAppId: null as string | null,
    sarvamVersion: null as number | null,
    learn: s.learn,
    watch: s.watch,
  };

  await prisma.scenario.upsert({
    where: { id: s.id },
    create: { id: s.id, ...base },
    update: base,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
