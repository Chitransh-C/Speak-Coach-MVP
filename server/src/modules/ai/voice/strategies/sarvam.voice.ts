import type {
  BuildBootstrapInput,
  VoiceClientBootstrap,
  VoiceRuntimePort,
} from "../voice.types.js";

/** Sarvam Voice Agents — browser ConversationAgent + Node proxy. */
export class SarvamVoiceStrategy implements VoiceRuntimePort {
  readonly provider = "sarvam" as const;

  buildClientBootstrap(input: BuildBootstrapInput): VoiceClientBootstrap {
    return {
      provider: "sarvam",
      config: {
        orgId: input.agent.orgId,
        workspaceId: input.agent.workspaceId,
        appId: input.agent.appId,
        version: input.agent.version,
        proxyBaseUrl: input.proxyBaseUrl ?? "/api/sarvam",
      },
      initialLanguage: input.language,
      sarvamLanguageName: input.sarvamLanguageName,
      voice: input.voice,
      initialBotMessage: input.initialBotMessage,
      agentVariables: input.agentVariables,
    };
  }
}
