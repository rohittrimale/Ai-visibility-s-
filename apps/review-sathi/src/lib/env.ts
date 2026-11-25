import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  appUrl: () => (optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  tokenEncryptionKey: () => required("TOKEN_ENCRYPTION_KEY"),
  cronSecret: () => required("CRON_SECRET"),

  /** When true, Google is simulated with sample reviews (use until GBP API access is approved). */
  googleDemoMode: () => optional("GOOGLE_DEMO_MODE") === "true",
  googleClientId: () => required("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => required("GOOGLE_CLIENT_SECRET"),

  anthropicApiKey: () => optional("ANTHROPIC_API_KEY"),
  anthropicModel: () => optional("ANTHROPIC_MODEL") ?? "claude-opus-5-5",

  razorpayKeyId: () => required("RAZORPAY_KEY_ID"),
  razorpayKeySecret: () => required("RAZORPAY_KEY_SECRET"),
  razorpayWebhookSecret: () => required("RAZORPAY_WEBHOOK_SECRET"),
  razorpayPlanStarter: () => required("RAZORPAY_PLAN_STARTER"),
  razorpayPlanGrowth: () => required("RAZORPAY_PLAN_GROWTH"),

  resendApiKey: () => optional("RESEND_API_KEY"),
  emailFrom: () => optional("EMAIL_FROM") ?? "ReviewSathi <alerts@example.com>",
};
