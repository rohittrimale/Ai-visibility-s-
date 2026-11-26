import Link from "next/link";
import { Logo, Stars, inr } from "@/components/ui";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";

const FAQ = [
  {
    q: "Will replies go live without my permission?",
    a: "Only if you turn on auto-reply, and even then only for good reviews. Reviews at or below your alert level always wait for you to approve them.",
  },
  {
    q: "Can it reply in Hindi or Marathi?",
    a: "Yes. By default it replies in the language the customer wrote in: English, Hindi, Hinglish or Marathi. You can also fix one language per shop.",
  },
  {
    q: "How do I pay?",
    a: "Monthly through Razorpay with UPI AutoPay, cards or net banking. Cancel any time from your dashboard.",
  },
  {
    q: "Do I need to share my Google password?",
    a: "No. You sign in with Google and give ReviewSathi permission to manage reviews and posts. You can remove access any time from your Google account.",
  },
  {
    q: "What kinds of businesses is this for?",
    a: "Any local business with a Google Business Profile: restaurants, sweet shops, salons, gyms, clinics, coaching classes, hotels and stores.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <a href="#pricing" className="btn-ghost hidden sm:inline-flex">
            Pricing
          </a>
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/login?mode=signup" className="btn-primary">
            Start free trial
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
              For restaurants, salons, gyms, clinics and shops across India
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-stone-900 md:text-5xl">
              Reply to every Google review in seconds.
            </h1>
            <p className="mt-4 text-lg text-stone-600">
              ReviewSathi writes a thoughtful reply to each review in your customer&apos;s language, warns you the moment someone leaves a bad
              one, and drafts a fresh Google post every week. More replies and more posts help you rank higher on Google Maps.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login?mode=signup" className="btn-primary px-6 py-3 text-base">
                Try free for {TRIAL_DAYS} days
              </Link>
              <a href="#how" className="btn-secondary px-6 py-3 text-base">
                See how it works
              </a>
            </div>
            <p className="mt-3 text-sm text-stone-500">No card needed for the trial. Pay with UPI after that.</p>
          </div>

          <div className="card space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Rahul Verma</span>
                <Stars rating={4} />
              </div>
              <p className="mt-1 text-stone-700">समोसे बहुत अच्छे थे, लेकिन शाम को थोड़ी भीड़ रहती है।</p>
            </div>
            <div className="rounded-lg bg-brand-50 p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-brand-700">Suggested reply</p>
              <p className="text-stone-800">
                राहुल जी, समोसे पसंद आने के लिए दिल से धन्यवाद! शाम की भीड़ के लिए माफ़ी चाहते हैं, हम सर्विस और तेज़ करने पर काम कर रहे हैं।
                फिर ज़रूर आइए!
              </p>
            </div>
            <div className="flex gap-2">
              <span className="btn-primary pointer-events-none">Approve and post</span>
              <span className="btn-secondary pointer-events-none">Edit</span>
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-stone-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
            {[
              {
                title: "1. Connect Google",
                body: "Sign in with the Google account that manages your Business Profile. It takes one minute.",
              },
              {
                title: "2. Approve AI replies",
                body: "Every new review gets a reply draft that mentions what the customer said. Approve, edit or let good ones post automatically.",
              },
              {
                title: "3. Never miss a bad review",
                body: "Get an email within the hour when someone leaves a low rating, with a calm, polite reply ready to go.",
              },
            ].map((step) => (
              <div key={step.title}>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-stone-600">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold">Why replying matters</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="card">
              <p className="font-semibold">Rank higher on Maps</p>
              <p className="mt-2 text-sm text-stone-600">Google says responding to reviews and keeping your profile active helps your local visibility.</p>
            </div>
            <div className="card">
              <p className="font-semibold">Win back unhappy customers</p>
              <p className="mt-2 text-sm text-stone-600">A quick, kind reply to a bad review often turns a 1-star into a second visit, and future customers see that you care.</p>
            </div>
            <div className="card">
              <p className="font-semibold">Save hours every week</p>
              <p className="mt-2 text-sm text-stone-600">No more typing the same thank-you note. Spend two minutes a week approving replies instead.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-y border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <h2 className="text-center text-2xl font-bold">Simple monthly pricing</h2>
            <p className="mt-2 text-center text-stone-600">
              Every plan starts with a {TRIAL_DAYS}-day free trial. Pay monthly by UPI AutoPay, card or net banking. Prices exclude GST.
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl gap-6 md:grid-cols-2">
              {Object.values(PLANS).map((plan) => (
                <div key={plan.id} className={`card flex flex-col ${plan.id === "growth" ? "border-brand-600 ring-2 ring-brand-100" : ""}`}>
                  <p className="text-lg font-semibold">{plan.name}</p>
                  <p className="mt-2">
                    <span className="text-3xl font-bold">{inr(plan.priceInr)}</span>
                    <span className="text-stone-500"> / month</span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-stone-700">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <span className="text-brand-700">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/login?mode=signup&plan=${plan.id}`} className={`mt-6 ${plan.id === "growth" ? "btn-primary" : "btn-secondary"}`}>
                    Start free trial
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-14">
          <h2 className="text-2xl font-bold">Questions</h2>
          <div className="mt-6 divide-y divide-stone-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="cursor-pointer list-none font-medium">
                  <span className="mr-2 inline-block text-brand-700 transition group-open:rotate-90">›</span>
                  {item.q}
                </summary>
                <p className="mt-2 pl-5 text-stone-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ReviewSathi. Made in India.</p>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com"}`}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
