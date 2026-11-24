import { config } from "../config";
import { postJson, cost } from "./http";
import { mockAnswer } from "./mock";
import type { Provider } from "./types";

type Resp = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

export const gemini: Provider = {
  id: "gemini",
  label: "Gemini",
  isEnabled() {
    if (!config.flag(process.env.ENABLE_GEMINI, true)) return false;
    return config.mock || !!process.env.GEMINI_API_KEY;
  },
  async ask(prompt, ctx) {
    if (config.mock) return mockAnswer("gemini", prompt, ctx);
    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const r = await postJson<Resp>(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      { "x-goog-api-key": process.env.GEMINI_API_KEY! }, // header, not query string, so it never lands in URL logs
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 700 },
      },
      { signal: ctx?.signal, label: "Gemini" },
    );
    const text = r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      text,
      sources: [],
      costUsd: cost(r.usageMetadata?.promptTokenCount, r.usageMetadata?.candidatesTokenCount, 0.1, 0.4),
    };
  },
};
