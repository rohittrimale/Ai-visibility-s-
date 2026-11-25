import Anthropic from "@anthropic-ai/sdk";
import { MAX_POST_CHARS, MAX_REPLY_CHARS } from "@/lib/reviews/policy";
import {
  buildPostPrompt,
  buildReplyPrompt,
  templatePost,
  templateReply,
  tidyGeneratedText,
  type PostPromptInput,
  type ReplyPromptInput,
} from "./prompts";

/** Minimal text-generation interface so drafting can be tested without the network. */
export type TextGenerator = (req: { system: string; user: string; maxTokens: number }) => Promise<string>;

export class GenerationRefusedError extends Error {
  constructor() {
    super("The AI declined to write this draft. Please write the reply yourself.");
    this.name = "GenerationRefusedError";
  }
}

export function anthropicGenerator(opts: { apiKey: string; model: string }): TextGenerator {
  const client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 3, timeout: 60_000 });
  return async ({ system, user, maxTokens }) => {
    const response = await client.beta.messages.create({
      model: opts.model,
      max_tokens: maxTokens,
      // Short, well-specified writing: low effort keeps it fast and cheap.
      output_config: { effort: "low" },
      // If the primary model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") throw new GenerationRefusedError();
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!text) throw new Error("The AI returned an empty draft");
    return text;
  };
}

export type Drafter = {
  reply(input: ReplyPromptInput): Promise<string>;
  post(input: PostPromptInput): Promise<string>;
};

/** Without a generator (no API key), falls back to simple templates. */
export function createDrafter(generator: TextGenerator | null): Drafter {
  return {
    async reply(input) {
      if (!generator) return templateReply(input);
      const { system, user } = buildReplyPrompt(input);
      return tidyGeneratedText(await generator({ system, user, maxTokens: 4000 }), MAX_REPLY_CHARS);
    },
    async post(input) {
      if (!generator) return templatePost(input);
      const { system, user } = buildPostPrompt(input);
      return tidyGeneratedText(await generator({ system, user, maxTokens: 4000 }), MAX_POST_CHARS);
    },
  };
}
