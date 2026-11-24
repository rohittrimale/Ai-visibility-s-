export type EngineId = "openai" | "gemini" | "perplexity";

export type AskContext = {
  signal?: AbortSignal;
  /**
   * Only used by the mock provider. Real providers must NEVER receive the brand,
   * otherwise it would bias the answer we are trying to measure.
   */
  mock?: { brand: string; competitors: string[] };
};

export type AnswerResult = {
  text: string;
  sources: string[]; // citation URLs when the engine returns them
  costUsd: number;
};

/** Common interface every answer engine implements. */
export interface Provider {
  readonly id: EngineId;
  readonly label: string;
  /** False when disabled via ENABLE_<X>=0 or when no API key is set (unless AI_MOCK=1). */
  isEnabled(): boolean;
  ask(prompt: string, ctx?: AskContext): Promise<AnswerResult>;
}
