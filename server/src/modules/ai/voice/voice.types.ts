/** Provider-agnostic voice runtime bootstrap (Strategy). */

export type VoiceAgentIds = {
  orgId: string;
  workspaceId: string;
  appId: string;
  version: number;
};

export type VoiceClientBootstrap = {
  provider: "sarvam" | "gemini";
  /** Opaque provider config for the browser adapter */
  config: Record<string, unknown>;
  initialLanguage?: string;
  sarvamLanguageName?: string;
  voice?: string;
  initialBotMessage?: string;
  agentVariables?: Record<string, string>;
};

export type BuildBootstrapInput = {
  agent: VoiceAgentIds;
  language: string;
  sarvamLanguageName: string;
  voice: string;
  initialBotMessage?: string;
  agentVariables: Record<string, string>;
  /** Relative proxy base for Sarvam browser SDK, e.g. /api/sarvam */
  proxyBaseUrl?: string;
};

export interface VoiceRuntimePort {
  readonly provider: "sarvam" | "gemini";
  buildClientBootstrap(input: BuildBootstrapInput): VoiceClientBootstrap;
}
