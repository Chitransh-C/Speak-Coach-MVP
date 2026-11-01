/** System instruction for Lumi — RoleSmith floating voice help assistant. */

export const LUMI_ASSISTANT_CALL_MIN = 2;

export function buildLumiAssistantSystemInstruction(): string {
  return [
    "You are Lumi, the friendly floating voice help assistant for RoleSmith.",
    "RoleSmith is a conversational practice app: learners pick scenarios, learn, watch, set up language/voice, practice with an AI partner, then review scores.",
    "",
    "Personality: warm, brief, helpful. Keep spoken answers short (1–3 sentences) unless the user asks for detail.",
    "You help with navigation, finding scenarios, starting practice setup, creating personal scenarios, reading session reports, and checking progress.",
    "",
    "TOOLS — you MUST call tools to take actions. Never pretend you navigated or created something without calling the tool.",
    "- navigate: open a page (home/scenarios catalog, my scenarios, create scenario form, journey, reports/activity, or a scenario learn/watch/setup path).",
    "- list_scenarios: search or list scenarios. Catalog tracks are interviews/sales; trackId=personal lists the user's private scenarios.",
    "- start_practice: send the user to setup (or learn) for a scenario so they can practice. Do NOT start the live practice mic yourself.",
    "- configure_setup: set practice language and/or voice for a scenario (must match character gender for voices). Prefer this before practice when the user picks language/voice. Can open setup or go straight to practice.",
    "- create_scenario: create a personal scenario after you have title, description/situation, and AI partner name (role/gender optional). Ask briefly for missing fields, then call the tool once.",
    "- read_report: summarize a practice session report/score (use sessionId if known, otherwise latest).",
    "- my_progress: summarize the user's scenario completion and scores.",
    "- view_history: recall what you and the user discussed in earlier Lumi chats on this device.",
    "- sleep: end this help session after a short goodbye. Call sleep when the user is done, says bye, or you have finished helping.",
    "",
    "When helping someone start practice: confirm language and voice with configure_setup when they care; otherwise open setup so they can choose (and hear voice previews).",
    "",
    `Session length is about ${LUMI_ASSISTANT_CALL_MIN} minutes. When time is nearly up or the user is finished, say a brief goodbye and call sleep.`,
    "Do not role-play as a scenario partner. You are Lumi the helper only.",
  ].join("\n");
}

/** Shared tool schemas for ephemeral mint (JSON) — mirrored on the client. */
export const LUMI_ASSISTANT_TOOLS = {
  functionDeclarations: [
    {
      name: "navigate",
      description:
        "Open a RoleSmith page. Use destination keys or a path. Prefer destination when possible.",
      parameters: {
        type: "OBJECT",
        properties: {
          destination: {
            type: "STRING",
            description:
              "One of: home, my_scenarios, create_scenario, journey, reports, learn, watch, setup",
          },
          scenarioId: {
            type: "STRING",
            description: "Required when destination is learn, watch, or setup",
          },
          path: {
            type: "STRING",
            description: "Optional explicit path like /journey or /scenarios/abc/learn",
          },
        },
      },
    },
    {
      name: "list_scenarios",
      description:
        "List or search scenarios. Use trackId interviews/sales for catalog, or personal for the user's private scenarios under the Personal track.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: {
            type: "STRING",
            description: "Optional search text matching title, description, or track",
          },
          trackId: {
            type: "STRING",
            description: "Optional track filter: interviews, sales, or personal",
          },
        },
      },
    },
    {
      name: "start_practice",
      description:
        "Send the user toward practice for a scenario (opens setup by default, or learn if stage=learn).",
      parameters: {
        type: "OBJECT",
        properties: {
          scenarioId: {
            type: "STRING",
            description: "Scenario id to practice",
          },
          stage: {
            type: "STRING",
            description: "setup (default) or learn",
          },
        },
        required: ["scenarioId"],
      },
    },
    {
      name: "configure_setup",
      description:
        "Save practice language and/or voice for a scenario, then open setup or practice. Voice must match the scenario partner gender. Language codes like en-IN, hi-IN; voice ids like Charon, Kore, Aoede.",
      parameters: {
        type: "OBJECT",
        properties: {
          scenarioId: {
            type: "STRING",
            description: "Scenario id to configure",
          },
          language: {
            type: "STRING",
            description: "BCP-47 language code e.g. en-IN, hi-IN, es-ES",
          },
          voice: {
            type: "STRING",
            description: "Gemini voice id e.g. Charon, Orus, Kore, Aoede",
          },
          goTo: {
            type: "STRING",
            description: "setup (default) or practice — practice only when language and voice are set",
          },
        },
        required: ["scenarioId"],
      },
    },
    {
      name: "create_scenario",
      description:
        "Create a personal (private) practice scenario for the user after collecting the essentials.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: {
            type: "STRING",
            description: "Short description of what the learner will practice",
          },
          situation: {
            type: "STRING",
            description: "Situation text for the AI partner context",
          },
          participantName: { type: "STRING" },
          participantRole: { type: "STRING" },
          participantGender: {
            type: "STRING",
            description: "male or female",
          },
          greeting: { type: "STRING" },
          objectives: {
            type: "STRING",
            description: "Optional objectives separated by newlines or semicolons",
          },
        },
        required: ["title", "participantName"],
      },
    },
    {
      name: "read_report",
      description: "Fetch and summarize a practice session report. Omit sessionId for the latest completed session.",
      parameters: {
        type: "OBJECT",
        properties: {
          sessionId: { type: "STRING" },
        },
      },
    },
    {
      name: "my_progress",
      description: "Summarize the user's overall practice progress across catalog scenarios.",
      parameters: {
        type: "OBJECT",
        properties: {},
      },
    },
    {
      name: "view_history",
      description: "Recall recent prior conversations the user had with Lumi on this device.",
      parameters: {
        type: "OBJECT",
        properties: {
          limit: {
            type: "NUMBER",
            description: "Max turns to return (default 20)",
          },
        },
      },
    },
    {
      name: "sleep",
      description: "End the Lumi help session after a spoken goodbye.",
      parameters: {
        type: "OBJECT",
        properties: {
          reason: {
            type: "STRING",
            description: "Short reason such as user_done, timeout, goodbye",
          },
        },
        required: ["reason"],
      },
    },
  ],
};
