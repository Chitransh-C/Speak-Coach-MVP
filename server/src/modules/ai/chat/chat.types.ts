/** Provider-agnostic chat completion port (Strategy). */

export type ChatCompleteInput = {
  system: string;
  user: string;
  temperature?: number;
  /** Output token budget (important for reasoning models that spend tokens before content). */
  maxTokens?: number;
  /**
   * JSON Schema for structured outputs (Gemini responseJsonSchema).
   * When set, providers that support it enforce schema-valid JSON.
   */
  responseSchema?: Record<string, unknown>;
};

export type ChatCompleteResult = {
  content: string;
  model: string;
  provider: string;
};

export interface ChatCompletionPort {
  readonly provider: string;
  complete(input: ChatCompleteInput): Promise<ChatCompleteResult>;
}
