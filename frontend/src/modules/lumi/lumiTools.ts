import { Type } from "@google/genai";
import type { FunctionDeclarationConfig } from "@/modules/practice/geminiLiveSession";

/** Client-side mirror of server LUMI_ASSISTANT_TOOLS. */
export const LUMI_CLIENT_TOOLS: FunctionDeclarationConfig[] = [
  {
    name: "navigate",
    description:
      "Open a RoleSmith page. Use destination keys or a path. Prefer destination when possible.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination: { type: Type.STRING },
        scenarioId: { type: Type.STRING },
        path: { type: Type.STRING },
      },
    },
  },
  {
    name: "list_scenarios",
    description:
      "List or search scenarios. Use trackId interviews/sales for catalog, or personal for the user's private scenarios.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING },
        trackId: { type: Type.STRING },
      },
    },
  },
  {
    name: "start_practice",
    description: "Send the user toward practice for a scenario (setup or learn).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scenarioId: { type: Type.STRING },
        stage: { type: Type.STRING },
      },
      required: ["scenarioId"],
    },
  },
  {
    name: "configure_setup",
    description:
      "Save practice language and/or voice for a scenario, then open setup or practice.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scenarioId: { type: Type.STRING },
        language: { type: Type.STRING },
        voice: { type: Type.STRING },
        goTo: { type: Type.STRING },
      },
      required: ["scenarioId"],
    },
  },
  {
    name: "create_scenario",
    description: "Create a personal practice scenario for the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        situation: { type: Type.STRING },
        participantName: { type: Type.STRING },
        participantRole: { type: Type.STRING },
        participantGender: { type: Type.STRING },
        greeting: { type: Type.STRING },
        objectives: { type: Type.STRING },
      },
      required: ["title", "participantName"],
    },
  },
  {
    name: "read_report",
    description: "Fetch and summarize a practice session report.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        sessionId: { type: Type.STRING },
      },
    },
  },
  {
    name: "my_progress",
    description: "Summarize the user's overall practice progress.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "view_history",
    description: "Recall recent prior Lumi conversations on this device.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER },
      },
    },
  },
  {
    name: "sleep",
    description: "End the Lumi help session after a spoken goodbye.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING },
      },
      required: ["reason"],
    },
  },
];

export const LUMI_CALL_DURATION_MIN = 2;
