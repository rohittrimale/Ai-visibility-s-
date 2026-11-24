import { gemini } from "./gemini";
import { openai } from "./openai";
import { perplexity } from "./perplexity";
import type { Provider } from "./types";

export const ALL_PROVIDERS: Provider[] = [openai, gemini, perplexity];
export const enabledProviders = (): Provider[] => ALL_PROVIDERS.filter((p) => p.isEnabled());
export const engineLabel = (id: string) => ALL_PROVIDERS.find((p) => p.id === id)?.label ?? id;
export type { Provider, EngineId, AskContext, AnswerResult } from "./types";
