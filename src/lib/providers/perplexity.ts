import { config } from "../config";
import { postJson, cost } from "./http";
import { mockAnswer } from "./mock";
import type { Provider } from "./types";

type Resp = {
  choices: { message: { content: string } }[];
  citations?: string[];
  usage?: { prompt_tokens: number; completion_tokens: number };
};

export const perplexity: Provider = {
  id: "perplexity",
  label: "Perplexity",
  isEnabled() {
    if (!config.flag(process.env.ENABLE_PERPLEXITY, true)) return false;
    return config.mock || !!process.env.PERPLEXITY_API_KEY;
  },
  async ask(prompt, ctx) {
    if (config.mock) return mockAnswer("perplexity", prompt, ctx);
    const r = await postJson<Resp>(
      "https://api.perplexity.ai/chat/completions",
      { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
      {
        model: process.env.PERPLEXITY_MODEL || "sonar",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      },
      { signal: ctx?.signal, label: "Perplexity" },
    );
    return {
      text: r.choices?.[0]?.message?.content ?? "",
      sources: (r.citations ?? []).slice(0, 10),
      // token cost + approximate per-request search fee
      costUsd: cost(r.usage?.prompt_tokens, r.usage?.completion_tokens, 1, 1) + 0.005,
    };
  },
};
