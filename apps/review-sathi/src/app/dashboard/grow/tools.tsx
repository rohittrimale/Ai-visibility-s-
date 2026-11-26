"use client";

import QRCode from "qrcode";
import { useActionState, useMemo, useState } from "react";
import {
  normalizeIndianPhone,
  REQUEST_LANGUAGES,
  reviewRequestMessage,
  whatsappLink,
  type RequestLanguage,
} from "@/lib/reviews/requests";
import { saveReviewLink, type LinkState } from "./actions";

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function QrDownload({ text, filename }: { text: string; filename: string }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        const url = await QRCode.toDataURL(text, { errorCorrectionLevel: "H", margin: 2, width: 1024 });
        const a = document.createElement("a");
        a.href = url;
        a.download = filename.replace(/[^\w.-]+/g, "-");
        a.click();
      }}
    >
      Download PNG
    </button>
  );
}

export function ReviewLinkForm({ id, customUrl, disabled }: { id: string; customUrl: string | null; disabled: boolean }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(saveReviewLink, { ok: false, message: null });
  const [open, setOpen] = useState(Boolean(customUrl));
  if (disabled) return null;
  if (!open) {
    return (
      <button type="button" className="text-sm text-stone-600 underline" onClick={() => setOpen(true)}>
        Use a different Google review link
      </button>
    );
  }
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`url-${id}`} className="label">
        Your Google review link (from &quot;Ask for reviews&quot; on your Business Profile)
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={`url-${id}`} name="url" className="input" placeholder="https://g.page/r/..." defaultValue={customUrl ?? ""} />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-stone-500">Leave empty to use the link from Google. Your QR code stays the same either way.</p>
      {state.message && <p className={`text-sm ${state.ok ? "text-brand-700" : "text-red-700"}`}>{state.message}</p>}
    </form>
  );
}

export function WhatsAppRequest({ businessName, link }: { businessName: string; link: string }) {
  const [language, setLanguage] = useState<RequestLanguage>("en");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [edited, setEdited] = useState<string | null>(null);

  const generated = useMemo(
    () => reviewRequestMessage({ language, businessName, link, customerName }),
    [language, businessName, link, customerName],
  );
  const message = edited ?? generated;
  const normalized = phone.trim() ? normalizeIndianPhone(phone) : null;
  const phoneInvalid = phone.trim().length > 0 && !normalized;

  return (
    <div className="card space-y-3">
      <p className="text-sm font-medium text-stone-700">Ask on WhatsApp</p>
      <div className="flex flex-wrap gap-1">
        {REQUEST_LANGUAGES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setLanguage(option.value);
              setEdited(null);
            }}
            className={`rounded-full px-3 py-1 text-sm ${language === option.value ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input"
          placeholder="Customer name (optional)"
          value={customerName}
          onChange={(e) => {
            setCustomerName(e.target.value);
            setEdited(null);
          }}
          maxLength={40}
        />
        <input
          className="input"
          placeholder="Mobile number (optional)"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={20}
        />
      </div>
      {phoneInvalid && <p className="text-sm text-red-700">Enter a 10-digit mobile number.</p>}
      <textarea className="input min-h-36" value={message} onChange={(e) => setEdited(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappLink(message, normalized)}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn-primary ${phoneInvalid ? "pointer-events-none opacity-50" : ""}`}
          aria-disabled={phoneInvalid}
        >
          Open in WhatsApp
        </a>
        <CopyButton text={message} label="Copy message" />
      </div>
      <p className="text-xs text-stone-500">
        {normalized ? "Opens a chat with this number." : "Without a number, WhatsApp lets you pick the contact."} Send it on the same day as the
        visit for the best response.
      </p>
    </div>
  );
}
