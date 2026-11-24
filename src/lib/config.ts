/** Central, server-side env access. Never import this from a client component. */

const flag = (v: string | undefined, dflt: boolean) =>
  v === undefined || v === "" ? dflt : !["0", "false", "off", "no"].includes(v.toLowerCase());
const num = (v: string | undefined, dflt: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : dflt;
};

export const config = {
  get siteUrl() {
    return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get paidEnabled() {
    return flag(process.env.NEXT_PUBLIC_PAID_ENABLED, false);
  },
  get mock() {
    return flag(process.env.AI_MOCK, false);
  },
  get monthlyCapUsd() {
    return num(process.env.MONTHLY_SPEND_CAP_USD, 50);
  },
  get estCostPerCheckUsd() {
    return num(process.env.EST_COST_PER_CHECK_USD, 0.15);
  },
  get ipLimit() {
    return num(process.env.FREE_CHECKS_PER_IP_PER_DAY, 2);
  },
  get emailLimit() {
    return num(process.env.FREE_CHECKS_PER_EMAIL_PER_DAY, 2);
  },
  get cacheTtlHours() {
    return num(process.env.CACHE_TTL_HOURS, 24);
  },
  get hashSalt() {
    return process.env.HASH_SALT || "dev-salt";
  },
  get parserModel() {
    return process.env.PARSER_MODEL || "gpt-4o-mini";
  },
  get emailFrom() {
    return process.env.EMAIL_FROM || "AI Visibility Checker <onboarding@resend.dev>";
  },
  flag,
};

export const PROMPTS_PER_FREE_CHECK = 8;
