import { config } from "../config";
import { postJson, cost } from "./http";
import { mockAnswer } from "./mock";
import type { Provider } from "./types";

type Resp = {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
};

export const openai: Provider = {
  id: "openai",
  label: "ChatGPT",
  isEnabled() {
    if (!config.flag(process.env.ENABLE_OPENAI, true)) return false;
    return config.mock || !!process.env.OPENAI_API_KEY;
  },
  async ask(prompt, ctx) {
    if (config.mock) return mockAnswer("openai", prompt, ctx);
    const r = await postJson<Resp>(
      "https://api.openai.com/v1/chat/completions",
      { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        max_tokens: 700,
        messages: [
          { role: "system", content: "You are a helpful assistant. Answer concisely with specific local recommendations where relevant." },
          { role: "user", content: prompt },
        ],
      },
      { signal: ctx?.signal, label: "OpenAI" },
    );
    return {
      text: r.choices?.[0]?.message?.content ?? "",
      sources: [],
      costUsd: cost(r.usage?.prompt_tokens, r.usage?.completion_tokens, 0.15, 0.6),
    };
  },
};
