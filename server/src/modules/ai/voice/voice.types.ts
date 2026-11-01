/** Gemini Live voice runtime bootstrap. */

export type VoiceClientBootstrap = {
  provider: "gemini";
  /** Browser adapter config (model, voiceName, languageCode, tokenPath, …) */
  config: Record<string, unknown>;
  initialLanguage?: string;
  languageLabel?: string;
  voice?: string;
  initialBotMessage?: string;
  agentVariables?: Record<string, string>;
};

export type BuildBootstrapInput = {
  language: string;
  languageLabel: string;
  voice: string;
  gender?: "male" | "female";
  initialBotMessage?: string;
  agentVariables: Record<string, string>;
};

export interface VoiceRuntimePort {
  readonly provider: "gemini";
  buildClientBootstrap(input: BuildBootstrapInput): VoiceClientBootstrap;
}
