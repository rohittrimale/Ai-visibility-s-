export type PlanId = "free" | "starter" | "growth";

export type Plan = {
  id: PlanId;
  name: string;
  priceInr: number; // per month
  maxPrompts: number;
  maxBusinesses: number; // assumption: tune freely
  whiteLabelPdf: boolean;
  features: string[];
  razorpayPlanEnv?: string; // env var holding the Razorpay plan_id
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free", name: "Free", priceInr: 0, maxPrompts: 8, maxBusinesses: 0, whiteLabelPdf: false,
    features: ["One-off check", "8 prompts × 3 AI engines", "Emailed report"],
  },
  starter: {
    id: "starter", name: "Starter", priceInr: 1499, maxPrompts: 25, maxBusinesses: 1, whiteLabelPdf: false,
    razorpayPlanEnv: "RAZORPAY_PLAN_STARTER",
    features: ["25 prompts × 3 AI engines", "Weekly automatic re-check", "Score trend chart", "Custom prompts"],
  },
  growth: {
    id: "growth", name: "Growth", priceInr: 3999, maxPrompts: 100, maxBusinesses: 5, whiteLabelPdf: true,
    razorpayPlanEnv: "RAZORPAY_PLAN_GROWTH",
    features: ["100 prompts × 3 AI engines", "Up to 5 businesses", "White-label PDF reports", "Weekly re-check + trend chart"],
  },
};

export const isPlanId = (v: unknown): v is PlanId => v === "free" || v === "starter" || v === "growth";
export const planForRazorpayPlanId = (rzpPlanId: string): PlanId | null =>
  (["starter", "growth"] as const).find((p) => process.env[PLANS[p].razorpayPlanEnv!] === rzpPlanId) ?? null;
