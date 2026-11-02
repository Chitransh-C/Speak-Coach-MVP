import { env } from "../../../../shared/config/env.js";
import { AppError } from "../../../../shared/http/errors.js";
import { toGeminiVoiceName } from "../../../gemini/services/gemini.voice-map.js";
import type {
  BuildBootstrapInput,
  VoiceClientBootstrap,
  VoiceRuntimePort,
} from "../voice.types.js";

/**
 * Gemini Live voice — browser connects directly with a server-minted ephemeral token.
 * languageCode + voiceName are passed through to Live speechConfig.
 * @see https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api/configure-language-voice
 */
export class GeminiVoiceStrategy implements VoiceRuntimePort {
  readonly provider = "gemini" as const;

  buildClientBootstrap(input: BuildBootstrapInput): VoiceClientBootstrap {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "VOICE_UNAVAILABLE",
        "GEMINI_API_KEY is required for Gemini Live practice",
      );
    }

    const gender = input.gender ?? "male";
    const voiceName = toGeminiVoiceName(input.voice, gender);

    return {
      provider: "gemini",
      config: {
        model: env.GEMINI_VOICE_MODEL,
        voiceName,
        tokenPath: "/gemini/ephemeral-token",
        languageCode: input.language,
        languageLabel: input.languageLabel,
        gender,
      },
      initialLanguage: input.language,
      languageLabel: input.languageLabel,
      voice: voiceName,
      initialBotMessage: input.initialBotMessage,
      agentVariables: input.agentVariables,
    };
  }
}
