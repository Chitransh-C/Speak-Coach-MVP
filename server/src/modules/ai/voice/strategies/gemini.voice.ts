import { env } from "../../../../shared/config/env.js";
import { AppError } from "../../../../shared/http/errors.js";
import type {
  BuildBootstrapInput,
  VoiceClientBootstrap,
  VoiceRuntimePort,
} from "../voice.types.js";

/**
 * Gemini Live voice — scaffold only.
 * Browser adapter + ephemeral token minting land in a follow-up.
 */
export class GeminiVoiceStrategy implements VoiceRuntimePort {
  readonly provider = "gemini" as const;

  buildClientBootstrap(_input: BuildBootstrapInput): VoiceClientBootstrap {
    if (!env.GEMINI_API_KEY) {
      throw new AppError(
        503,
        "VOICE_UNAVAILABLE",
        "GEMINI_API_KEY is required when VOICE_PROVIDER=gemini",
      );
    }
    throw new AppError(
      501,
      "VOICE_UNAVAILABLE",
      "Gemini Live voice adapter is not wired yet. Set VOICE_PROVIDER=sarvam for practice calls.",
    );
  }
}
