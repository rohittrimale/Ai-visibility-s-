import { z } from "zod";

/** Strip control chars, angle brackets and collapse whitespace. */
export function sanitizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>`{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Letters (any language), digits, spaces and a few punctuation marks businesses actually use.
const SAFE_NAME = /^[\p{L}\p{M}\p{N} .,'’&()\-]+$/u;

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(
      z
        .string()
        .min(min, `${label} is required`)
        .max(max, `${label} is too long`)
        .regex(SAFE_NAME, `${label} contains unsupported characters`),
    );

/** Accepts "example.com" or full URLs; returns the normalised origin. Rejects internal hosts. */
export function normalizeUrl(raw: string): string | null {
  const s = sanitizeText(raw);
  if (!s || s.length > 200) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":")) return null; // raw IPs
  if (url.username || url.password) return null;
  return `${url.protocol}//${host}`;
}

export const hostOf = (origin: string) => new URL(origin).hostname.replace(/^www\./, "");

export const checkInputSchema = z.object({
  businessName: text("Business name", 2, 80),
  website: z
    .string()
    .transform((v, ctx) => {
      const n = normalizeUrl(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid website URL" });
      return n ?? "";
    }),
  city: text("City", 2, 60),
  category: text("Category", 2, 50),
  competitors: z
    .array(z.string().transform(sanitizeText))
    .max(3, "Up to 3 competitors")
    .default([])
    .transform((arr) => arr.filter(Boolean))
    .pipe(z.array(text("Competitor name", 2, 80)).max(3)),
  // honeypot: real users leave this empty
  hp: z.string().max(0).optional().default(""),
});
export type CheckInput = z.infer<typeof checkInputSchema>;

export const emailSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email("Enter a valid email").max(254));

export const unlockSchema = z.object({
  checkId: z.uuid(),
  email: emailSchema,
});
