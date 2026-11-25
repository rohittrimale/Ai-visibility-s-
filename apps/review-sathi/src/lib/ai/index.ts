import "server-only";
import { env } from "@/lib/env";
import { anthropicGenerator, createDrafter, type Drafter } from "./generate";

let drafter: Drafter | null = null;

export function getDrafter(): Drafter {
  if (!drafter) {
    const apiKey = env.anthropicApiKey();
    drafter = createDrafter(apiKey ? anthropicGenerator({ apiKey, model: env.anthropicModel() }) : null);
  }
  return drafter;
}
