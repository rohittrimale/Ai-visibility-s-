# AI Visibility Checker

Free tool for local businesses: do ChatGPT, Gemini and Perplexity recommend my business? Captures leads (email-gated report) and is structured for a paid monthly plan.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 3 · Supabase (Postgres + Auth) · Resend · Razorpay.

## How it works

1. Form → `POST /api/check` validates and sanitizes input, then applies **IP limit** (2/day) and reserves **monthly budget** atomically.
2. `lib/prompts.ts` generates 8 customer prompts from category + city.
3. `lib/runner.ts` asks each enabled provider (`lib/providers/*`, one module each, common `Provider` interface). Raw answers are **cached 24h** by (engine, prompt).
4. `lib/parser.ts` parses each answer to `{brand_mentioned, position, sentiment, competitors_mentioned, sources}` with an OpenAI JSON-mode call (heuristic fallback if it fails or no key).
5. `lib/scoring.ts`: per answer, 0 if not mentioned, else a position weight (#1 = 1.0 … #6+ = 0.3, unranked mention = 0.5). Engine score = average × 100; overall = equal-weight average of engines that responded. Failed calls are excluded.
6. `/results/[id]` shows score + per-engine breakdown + one tip for free. Prompts, competitors and remaining tips are **redacted server-side** until the visitor enters an email (`POST /api/unlock`, 2/email/day), which stores a lead and emails the report via Resend.

Note: the email limit is enforced at unlock (the email isn't known earlier); the IP limit at check start.

## Local setup

```bash
npm install
cp .env.example .env.local
```

**No keys needed to try it:** set `AI_MOCK=1` in `.env.local` (fake deterministic answers) and run `npm run dev`. Without Supabase env vars the app uses an in-memory store in development only (it refuses to start that way in production).

For real use:
1. Create a Supabase project, run `supabase/schema.sql` in the SQL editor.
2. Fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Add at least one provider key; set `AI_MOCK=0`. Disable any engine with `ENABLE_OPENAI|GEMINI|PERPLEXITY=0`.
4. Add `RESEND_API_KEY` and a verified `EMAIL_FROM`. Without it, unlock still works but no email is sent.
5. Set `HASH_SALT` to a random string.

Commands: `npm run dev` · `npm test` · `npm run typecheck` · `npm run build`.

## Deploy to Vercel

1. Push the repo to GitHub, import it in Vercel.
2. Add every variable from `.env.example` (Production). Set `NEXT_PUBLIC_SITE_URL` to your domain. `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.
3. `/api/check` uses `maxDuration = 60`, which the Hobby plan allows. Check duration is ~30-60s with real APIs.
4. Weekly cron is in `vercel.json` (`/api/cron/weekly`, Mondays 03:00 UTC). Set `CRON_SECRET`; Vercel sends it as a bearer token. Alternative: Supabase `pg_cron` + `pg_net` calling the same URL with the same header.
5. Supabase Auth → URL configuration: add `https://YOURDOMAIN/auth/callback` as a redirect URL.
6. Razorpay: create two monthly plans (₹1,499 and ₹3,999), put their ids in `RAZORPAY_PLAN_STARTER/GROWTH`; add a webhook to `https://YOURDOMAIN/api/billing/webhook` for `subscription.activated|charged|cancelled|halted|completed` and put its secret in `RAZORPAY_WEBHOOK_SECRET`.

## Paid features (built, switched off)

Set `NEXT_PUBLIC_PAID_ENABLED=1` to expose them: Supabase magic-link login (`/login`), `/dashboard` (saved businesses, trend chart), `/api/businesses`, weekly cron re-run, `/pricing` + Razorpay subscription and signature-verified webhook (the only code that changes a user's plan), and white-label print/PDF view at `/report/[id]/print?brand=Agency&color=%231d4ed8`.

Known gaps: the first tracked check only runs on the next cron (no "run now" button); the cron processes businesses sequentially in one invocation (move to a queue at scale); 100-prompt plans currently get ~35 generated unique prompts until custom prompts are added; `maxBusinesses` per plan (1 / 5) is my assumption.

## Cost and abuse controls

- Rate limits: atomic SQL counters per salted-hash of IP and email, per UTC day.
- Monthly cap: `reserve_spend()` atomically reserves `EST_COST_PER_CHECK_USD` against `MONTHLY_SPEND_CAP_USD`, then the real cost is settled. At the cap, free checks return 503. Every provider call is also written to `usage_log`.
- Cache: identical prompts reuse raw answers for 24h (answers are brand-agnostic; parsing is redone per business).
- Inputs: zod validation, character allow-list, URL normalisation (no IPs/localhost/credentials), body size caps, honeypot field.
- Keys are server-side only; Gemini key goes in a header, not the URL. RLS is on for all tables and the counter RPCs are revoked from anon/authenticated.

## Before launch: test checklist

- [ ] Run `schema.sql` on a fresh Supabase project; re-run it to confirm it's idempotent.
- [ ] One real check with each provider key; confirm costs in `usage_log` match provider dashboards, then tune `EST_COST_PER_CHECK_USD` and the price table in `lib/providers/*`.
- [ ] Disable each engine in turn (`ENABLE_X=0`) and confirm the app still works.
- [ ] Hit `/api/check` 3× from one IP → third returns 429; unlock 3× with one email → third returns 429.
- [ ] Set `MONTHLY_SPEND_CAP_USD` tiny → free checks return the "paused" message.
- [ ] View-source a locked results page: no prompts/competitors/tips beyond the first.
- [ ] Resend: verified domain, email lands in inbox (not spam), links point to production.
- [ ] Mobile pass on iOS Safari and Android Chrome; slow-network behaviour of the ~45s wait.
- [ ] Check `/sitemap.xml`, `/robots.txt`, niche page titles/H1s; submit sitemap to Search Console.
- [ ] Privacy policy + consent wording for collecting emails (needed before running ads).
- [ ] Paid (before enabling): Razorpay test-mode subscription → webhook → plan changes; cancel → plan reverts; cron with the right and wrong secret; RLS (user A can't see user B's businesses).
- [ ] Rotate `HASH_SALT`/secrets only knowingly: changing the salt resets rate-limit history.

Disclaimer shown in the UI: "AI answers vary by user and location; this is an estimate."
