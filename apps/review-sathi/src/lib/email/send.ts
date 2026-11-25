import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import type { Email } from "./templates";

let client: Resend | null = null;

/** Sends an email through Resend. Without RESEND_API_KEY it logs instead, so dev and demo still work. */
export async function sendEmail(to: string, email: Email): Promise<boolean> {
  const apiKey = env.resendApiKey();
  if (!apiKey) {
    console.info(`[email:dev] to=${to} subject="${email.subject}"`);
    return false;
  }
  client ??= new Resend(apiKey);
  const { error } = await client.emails.send({
    from: env.emailFrom(),
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) {
    console.error(`[email] failed to send "${email.subject}": ${error.message}`);
    return false;
  }
  return true;
}
