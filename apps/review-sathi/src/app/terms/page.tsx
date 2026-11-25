import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";

export const metadata: Metadata = { title: "Terms of service" };

const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="25 November 2026">
      <p>By using ReviewSathi you agree to these terms.</p>
      <h2>The service</h2>
      <p>
        ReviewSathi drafts replies to your Google reviews and posts for your Google Business Profile using AI, and can publish them for you when you
        approve them or turn on auto-reply. You are responsible for the content published on your profile. Review AI drafts before approving them.
      </p>
      <h2>Your Google account</h2>
      <p>
        You must own or be authorised to manage the Business Profiles you connect. You must follow Google&apos;s policies, including the rules against
        fake or incentivised reviews. ReviewSathi does not create or buy reviews.
      </p>
      <h2>Trial, billing and cancellation</h2>
      <ul>
        <li>New accounts get a 14-day free trial. No payment details are needed for the trial.</li>
        <li>Paid plans renew monthly through Razorpay until you cancel. Prices are in Indian rupees and exclude GST.</li>
        <li>You can cancel any time in Billing. You keep access until the end of the period you paid for. We do not refund partial months.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Do not use ReviewSathi to harass reviewers, post misleading content, or break any law.</p>
      <h2>Liability</h2>
      <p>
        The service is provided as is. To the extent the law allows, our total liability is limited to the fees you paid in the three months before
        the claim.
      </p>
      <h2>Contact</h2>
      <p>{support}</p>
    </LegalPage>
  );
}
