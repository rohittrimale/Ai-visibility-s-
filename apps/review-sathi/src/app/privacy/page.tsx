import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Privacy policy" };

const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="25 November 2026">
      <p>
        ReviewSathi (&quot;we&quot;) helps local businesses reply to Google reviews and publish Google Business Profile posts. This policy explains
        what we collect, why, and your choices.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your account details: email address and the business details you enter (name, type, city, alert email).</li>
        <li>
          Google Business Profile data you authorise: your listings (name and address), the reviews customers left on them, existing replies, and
          posts we publish for you.
        </li>
        <li>Google OAuth tokens, stored encrypted, so we can act on your behalf when you are not signed in.</li>
        <li>Billing records from Razorpay (subscription status and dates). We never see or store your card or UPI details.</li>
      </ul>
      <h2>How we use Google user data</h2>
      <p>
        We use Google user data only to provide the features you see in the product: showing your reviews, drafting replies, posting replies and
        posts you approve (or that you have set to post automatically), and alerting you to new reviews. We do not sell it, use it for advertising,
        or use it to train general AI models.
      </p>
      <p>
        ReviewSathi&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>
      <h2>Service providers</h2>
      <ul>
        <li>Supabase (database and sign-in)</li>
        <li>Vercel (hosting)</li>
        <li>Anthropic (AI drafting of replies and posts; review text is sent to generate a draft and is not used to train models)</li>
        <li>Resend (email delivery)</li>
        <li>Razorpay (payments)</li>
      </ul>
      <h2>Retention and deletion</h2>
      <p>
        We keep your data while your account is active. Disconnecting Google in Settings deletes your stored Google tokens immediately. To delete your
        account and all data, email {support}; we complete deletion within 30 days. You can also remove our access at any time from your Google
        Account&apos;s third-party access page.
      </p>
      <h2>Security</h2>
      <p>Data is encrypted in transit. Google tokens are encrypted at rest with AES-256-GCM. Each business can only see its own data.</p>
      <h2>Contact</h2>
      <p>Questions or grievances: {support}</p>
    </LegalPage>
  );
}
