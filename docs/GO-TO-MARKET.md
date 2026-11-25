# How this makes money

## What we sell
| Product | Price | Who buys | Status |
|---|---|---|---|
| Free AI visibility check | ₹0 | Local business owners | Live. Captures emails (leads). |
| **Deep Audit** | **₹999 one-time** | Owners who saw a bad free score; agencies prospecting | **Built in this PR.** No login, pay by UPI. |
| Starter tracking | ₹1,499/mo | Owners who bought an audit and want to track fixes | Built, switch on with `NEXT_PUBLIC_PAID_ENABLED=1` |
| Growth (5 businesses, white-label PDF) | ₹3,999/mo | Small agencies | Built, same switch |

## Why this angle
Existing AI-visibility tools (Otterly ~$29, BrightLocal ~$31, Peec ~$95, Semrush ~$99, Profound/AthenaHQ ~$295+/mo) are priced in dollars, sold as subscriptions and built for brands and marketers. Almost none target a dentist or salon owner in an Indian city, and almost none sell a cheap one-time answer. A ₹999 UPI payment is an impulse buy right after seeing "ChatGPT recommends your 3 competitors, not you". Gross margin is ~95% (about ₹25-50 of API cost per audit).

## First 30 days
1. **Week 1: go live.** Deploy (README "Deploy to Vercel"), add OpenAI + Perplexity keys (Gemini optional), Supabase, Resend, Razorpay. Do one real ₹999 audit on your own card in test mode, then live.
2. **Week 1-2: direct outreach (fastest first rupee).** Pick one city and one niche (e.g. dentists in Pune). Run 30 free checks on real clinics. WhatsApp/email each owner a screenshot: "When patients ask ChatGPT for the best dentist in Pune, it names X, Y and Z. You weren't mentioned. Here's your free report: <link>." Expect a few % to buy the audit.
3. **Week 2-3: agencies.** Send `/agencies` to 20 local SEO/digital-marketing agencies. One agency on Growth is worth 3 single-business subscribers.
4. **Week 3-4: turn on subscriptions** (`NEXT_PUBLIC_PAID_ENABLED=1`) and email every audit buyer after 30 days: "Re-check your score."
5. **Always:** submit the sitemap to Google Search Console; the niche pages (`/dentists`, `/salons`, …) are the SEO engine. Add a niche page per category you get traction in.

## Targets to watch
- Free check → unlock (email) rate: aim 30%+.
- Unlock → Deep Audit purchase: aim 2-5%.
- 100 free checks/day at 3% = 3 audits/day ≈ ₹90,000/month before subscriptions.

These are estimates, not measurements. Track the real numbers in Supabase (`checks`, `leads`, `audits`).
