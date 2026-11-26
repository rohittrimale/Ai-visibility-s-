# ReviewSathi

AI replies to Google reviews for Indian local businesses: restaurants, sweet shops, salons, gyms, clinics and stores.

- **Connect Google Business Profile** with Google sign-in (OAuth). Tokens are encrypted at rest.
- **AI reply drafts** for every new review, in the customer's language: English, Hindi, Hinglish or Marathi. Owners approve, edit, or let 4 and 5 star replies post automatically. Low ratings always wait for a person.
- **Bad-review alerts** by email within the hour, with a calm reply already drafted.
- **Get more reviews**: a trackable short review link per location, a QR code and printable counter poster, and a ready WhatsApp review request in English, Hindi, Hinglish or Marathi. Messages follow Google's rules: they go to every customer and offer nothing in return.
- **Weekly Google post drafts** every Monday, emailed to the owner, published in one tap.
- **Multi-tenant dashboard** with row level security, so each business only ever sees its own data.
- **Razorpay subscriptions** (UPI AutoPay, cards) with a 14-day free trial, no card needed to start.
- **Demo mode** with sample reviews, so you can sell and demo before Google approves API access.

This app lives in `apps/review-sathi` and is independent of the AI Visibility Checker at the repo root. Deploy it as its own Vercel project.

## Stack

| Part | Choice |
| --- | --- |
| App | Next.js 16 (App Router, server actions), TypeScript, Tailwind CSS 4 |
| Auth and database | Supabase (magic-link login, Postgres, row level security) |
| AI | Anthropic API (`claude-opus-5-5`), with template fallback when no key is set |
| Payments | Razorpay Subscriptions |
| Email | Resend |
| Jobs | Vercel Cron (hourly sync, Monday posts, daily trial reminders) |
| Tests | Vitest (74 tests), GitHub Actions CI |

## How it works

```
Vercel Cron (hourly) ──► /api/cron/sync
                           for each connected business with an active trial or plan:
                             fetch reviews from Google ─► store new ones
                             draft replies with Claude (max 25 per location per run)
                             auto-post 4-5★ if the owner allowed it
                             email the owner about low ratings and new drafts

Owner ──► /dashboard ──► approve / edit / regenerate / don't reply ──► Google
Monday ──► /api/cron/weekly-posts ──► draft post per location ──► email owner ──► publish from /dashboard/posts
Razorpay ──► /api/webhooks/razorpay ──► subscription status ──► access on or off
```

Key files:

- `supabase/migrations/0001_init.sql`: schema, RLS policies, and triggers that stop users changing protected columns (plan, trial end, Google review data).
- `src/lib/sync/sync-location.ts`: the review sync rules (idempotent, backlog-aware, never auto-posts low ratings).
- `src/lib/ai/prompts.ts`: reply and post prompts, with review text fenced off from instructions.
- `src/lib/google/gbp.ts`: Google Business Profile client, plus the demo client.
- `src/lib/reviews/requests.ts`: review request messages, WhatsApp links and phone number handling.
- `src/lib/billing/plans.ts`: plans, prices and the access rules (trial, grace period, cancellation).

## Run locally

Requirements: Node 20.9+, and Docker if you want a local Supabase.

```bash
cd apps/review-sathi
npm install
cp .env.example .env.local
npx supabase start          # local Postgres + Auth + email inbox; prints the URL and keys
npx supabase db reset       # applies supabase/migrations
```

Put the printed `API URL`, `anon key` and `service_role key` into `.env.local`, then set:

```bash
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)
CRON_SECRET=$(openssl rand -hex 32)
GOOGLE_DEMO_MODE=true
```

```bash
npm run dev                 # http://localhost:3000
```

Sign up with any email. The magic link appears in the local inbox at http://127.0.0.1:54324. Create your business, then click **Connect Google Business Profile**. In demo mode this connects a sample sweet shop with reviews in English, Hindi and Marathi. Add an `ANTHROPIC_API_KEY` to see real AI drafts.

To run the hourly sync by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync
```

Checks:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Go live: what you need to set up

Do these in order. Step 1 is the slow one, so start it first.

### 1. Google Business Profile API access (can take days to weeks)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Request GBP API access with the [access request form](https://developers.google.com/my-business/content/prereqs). Use the same project. Google reviews it by hand. You'll get an email when approved; until then your quota is 0 and calls fail.
3. After approval, enable these APIs in the project: **My Business Account Management API**, **My Business Business Information API**, and **Google My Business API** (the v4 API used for reviews, replies and posts).
4. **OAuth consent screen**: External, app name ReviewSathi, your support email, your domain, links to `/privacy` and `/terms`. Add the scope `https://www.googleapis.com/auth/business.manage`. While in Testing, add your own Google account as a test user.
5. **Credentials → Create OAuth client ID → Web application**. Authorised redirect URI: `https://YOUR_DOMAIN/api/google/callback`. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Before onboarding real customers, submit the app for OAuth verification (the `business.manage` scope is sensitive). Google checks the privacy policy page, the homepage, and a short demo video.
7. Set `GOOGLE_DEMO_MODE=false`.

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com), region **Mumbai (ap-south-1)**.
2. Run the migrations: `npx supabase link --project-ref YOUR_REF && npx supabase db push`, or paste the files in `supabase/migrations/` into the SQL editor in order.
3. **Authentication → URL configuration**: Site URL `https://YOUR_DOMAIN`, redirect URL `https://YOUR_DOMAIN/auth/callback`.
4. **Authentication → SMTP**: use Resend's SMTP so magic-link emails come from your domain (Supabase's built-in mailer is rate-limited).
5. Optional: enable the Google provider in Auth and set `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=true`.
6. Copy the URL, anon key and service role key into the env vars.

### 3. Razorpay

1. Sign up and finish KYC at [razorpay.com](https://razorpay.com). Ask support to enable **Subscriptions** and **UPI AutoPay** if they aren't on.
2. **Subscriptions → Plans**: create two monthly plans, Starter ₹1,499 and Growth ₹2,999 (add GST in the amount if you're registered). Copy the plan IDs into `RAZORPAY_PLAN_STARTER` and `RAZORPAY_PLAN_GROWTH`.
3. **Account & Settings → API keys**: copy into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Use test keys first.
4. **Webhooks → Add**: URL `https://YOUR_DOMAIN/api/webhooks/razorpay`, choose a secret (put it in `RAZORPAY_WEBHOOK_SECRET`), and tick all `subscription.*` events.

Customers who subscribe during the trial set up AutoPay right away; Razorpay takes the first charge when the trial ends.

### 4. Anthropic

Create a key at [console.anthropic.com](https://console.anthropic.com) and set `ANTHROPIC_API_KEY`. Replies use low effort and are short, so cost per draft is small. Without a key, the app uses simple template replies.

### 5. Resend (email)

Create an account at [resend.com](https://resend.com), verify your domain (add the DNS records it shows), create an API key, and set `RESEND_API_KEY` and `EMAIL_FROM`.

### 6. Vercel and domain

1. Import the GitHub repo in Vercel. Set **Root Directory** to `apps/review-sathi`.
2. Add every variable from `.env.example`. Set `NEXT_PUBLIC_APP_URL` to your domain.
3. Add your domain under **Settings → Domains**.
4. Crons in `vercel.json` run hourly, which needs the **Pro** plan. On Hobby (daily only), use the included GitHub Action instead: `.github/workflows/review-sathi-cron.yml` (add two repo secrets and remove its `if: false` line).

### Launch checklist

- [ ] GBP API approved, OAuth app verified, `GOOGLE_DEMO_MODE=false`
- [ ] Razorpay live keys, live plans, webhook pointing at production
- [ ] Supabase redirect URLs and SMTP set to your domain
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` set; privacy and terms reviewed for your business
- [ ] Sign up yourself, connect your own listing, post one reply, subscribe with a test card, cancel

## Security notes

- Google refresh and access tokens are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`) and live in a table with no RLS policies, so only the server can read them.
- Users can only read and edit their own org's rows. Database triggers ignore attempts to change plan, trial dates, review content or posted status from the browser; posting goes through the server.
- The Google OAuth `state` is signed and expires after 10 minutes, and the callback checks the same user started the flow.
- Razorpay payment and webhook signatures are verified with constant-time comparison; webhook events are de-duplicated by event ID.
- Cron endpoints require `Authorization: Bearer $CRON_SECRET`.
- Review text is passed to the AI inside tags and treated as data, not instructions.
