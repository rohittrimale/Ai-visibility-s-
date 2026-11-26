/**
 * Asking customers for Google reviews.
 *
 * Google's review policy forbids offering anything in return for a review and
 * forbids asking only happy customers ("review gating"). The messages below
 * ask everyone the same way, offer nothing, and never ask for 5 stars.
 */

export type RequestLanguage = "en" | "hi" | "hinglish" | "mr";

export const REQUEST_LANGUAGES: { value: RequestLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी" },
  { value: "hinglish", label: "Hinglish" },
  { value: "mr", label: "मराठी" },
];

export function reviewRequestMessage(opts: {
  language: RequestLanguage;
  businessName: string;
  link: string;
  customerName?: string;
}): string {
  const name = opts.customerName?.trim();
  const biz = opts.businessName.trim();
  switch (opts.language) {
    case "hi":
      return `नमस्ते${name ? ` ${name} जी` : ""}! ${biz} आने के लिए धन्यवाद 🙏\nआपका अनुभव कैसा रहा? Google पर 1 मिनट में अपना review लिखें, इससे हमें बेहतर बनने में मदद मिलती है:\n${opts.link}`;
    case "hinglish":
      return `Namaste${name ? ` ${name} ji` : ""}! ${biz} aane ke liye dhanyavaad 🙏\nAapka experience kaisa raha? Google par 1 minute mein apna review likhiye, isse humein aur behtar banne mein madad milti hai:\n${opts.link}`;
    case "mr":
      return `नमस्कार${name ? ` ${name}` : ""}! ${biz} ला भेट दिल्याबद्दल धन्यवाद 🙏\nतुमचा अनुभव कसा होता? Google वर 1 मिनिटात तुमचा review लिहा, त्यामुळे आम्हाला अजून चांगले होण्यास मदत होते:\n${opts.link}`;
    default:
      return `Hi${name ? ` ${name}` : ""}! Thank you for visiting ${biz} 🙏\nHow was your experience? It takes 1 minute to share it on Google, and it really helps us improve:\n${opts.link}`;
  }
}

/**
 * Turns what a shop owner types into a wa.me number: digits only, with
 * India's 91 prefix for 10-digit mobile numbers. Returns null if it can't be a phone number.
 */
export function normalizeIndianPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) {
    return /^[6-9]/.test(digits) ? `91${digits}` : null;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return /^91[6-9]/.test(digits) ? digits : null;
  }
  // Other countries: accept plausible international numbers.
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0") ? digits : null;
}

/** Opens WhatsApp with the message ready. Without a phone, WhatsApp asks who to send it to. */
export function whatsappLink(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function shortReviewLink(appUrl: string, shortCode: string): string {
  return `${appUrl.replace(/\/$/, "")}/r/${shortCode}`;
}

/** Accepts only https links to Google (g.page, maps.app.goo.gl, google.com and similar). */
export function validateCustomReviewUrl(input: string): { ok: true; url: string | null } | { ok: false; error: string } {
  const value = input.trim();
  if (!value) return { ok: true, url: null };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, error: "That doesn't look like a link. Copy it from Google and paste it here." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The link must start with https://" };
  const host = url.hostname.toLowerCase();
  const allowed =
    host === "g.page" ||
    host === "maps.app.goo.gl" ||
    host === "goo.gl" ||
    host === "g.co" ||
    /^([a-z0-9-]+\.)*google\.(com|co\.in|in)$/.test(host);
  if (!allowed) return { ok: false, error: "Please paste a Google link (it usually starts with g.page or maps.app.goo.gl)." };
  return { ok: true, url: url.toString() };
}
