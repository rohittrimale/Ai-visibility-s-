"use client";

import { useActionState, useState, useTransition } from "react";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { disconnectGoogle, refreshLocations, updateBusiness, updateLocation, type FormState } from "./actions";

const initial: FormState = { ok: false, message: null };

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <span className={`text-sm ${state.ok ? "text-brand-700" : "text-red-700"}`}>{state.message}</span>;
}

export function GoogleActions({ connected }: { connected: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>(initial);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* A plain link: the route redirects to Google's consent screen. */}
      <a href="/api/google/connect" className={connected ? "btn-secondary" : "btn-primary"}>
        {connected ? "Reconnect Google" : "Connect Google Business Profile"}
      </a>
      {connected && (
        <>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => start(async () => setState(await refreshLocations()))}>
            Refresh locations
          </button>
          <button
            type="button"
            className="btn-ghost text-red-700"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Disconnect Google? Reviews will stop syncing until you connect again.")) {
                start(async () => setState(await disconnectGoogle()));
              }
            }}
          >
            Disconnect
          </button>
        </>
      )}
      <Status state={state} />
    </div>
  );
}

type Location = {
  id: string;
  title: string;
  address: string | null;
  enabled: boolean;
  reply_mode: string;
  reply_language: string;
  tone: string;
  signature: string | null;
  extra_instructions: string | null;
  last_synced_at: string | null;
};

export function LocationForm({ location, disabled }: { location: Location; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateLocation, initial);
  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="id" value={location.id} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{location.title}</p>
          {location.address && <p className="text-sm text-stone-500">{location.address}</p>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={location.enabled} className="size-4 accent-brand-700" disabled={disabled} />
          Manage this location
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor={`mode-${location.id}`}>
            Posting replies
          </label>
          <select id={`mode-${location.id}`} name="replyMode" className="input" defaultValue={location.reply_mode} disabled={disabled}>
            <option value="manual">I approve every reply</option>
            <option value="auto_positive">Auto-post replies to 4 and 5 stars</option>
            <option value="auto_all">Auto-post all except low ratings (Growth)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`lang-${location.id}`}>
            Reply language
          </label>
          <select id={`lang-${location.id}`} name="replyLanguage" className="input" defaultValue={location.reply_language} disabled={disabled}>
            <option value="auto">Same as the customer</option>
            <option value="en">English</option>
            <option value="hi">Hindi (हिंदी)</option>
            <option value="hinglish">Hinglish</option>
            <option value="mr">Marathi (मराठी)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`tone-${location.id}`}>
            Tone
          </label>
          <select id={`tone-${location.id}`} name="tone" className="input" defaultValue={location.tone} disabled={disabled}>
            <option value="warm">Warm</option>
            <option value="friendly">Friendly and casual</option>
            <option value="professional">Professional</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor={`sig-${location.id}`}>
            Sign-off (optional)
          </label>
          <input
            id={`sig-${location.id}`}
            name="signature"
            maxLength={80}
            className="input"
            placeholder="Team Sharma Sweets"
            defaultValue={location.signature ?? ""}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="label" htmlFor={`extra-${location.id}`}>
            Anything the AI should know (optional)
          </label>
          <textarea
            id={`extra-${location.id}`}
            name="extraInstructions"
            maxLength={1000}
            className="input min-h-10"
            placeholder="We're pure veg. Ask unhappy customers to call the manager, Sunil."
            defaultValue={location.extra_instructions ?? ""}
            disabled={disabled}
          />
        </div>
      </div>
      <p className="text-xs text-stone-500">Replies to ratings at or below your alert level always wait for your approval.</p>
      {!disabled && (
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}

type Org = {
  name: string;
  business_type: string;
  city: string | null;
  alert_email: string | null;
  negative_threshold: number;
  weekly_digest: boolean;
};

export function BusinessForm({ org, disabled }: { org: Org; disabled: boolean }) {
  const [state, action, pending] = useActionState(updateBusiness, initial);
  return (
    <form action={action} className="card space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="name">
            Business name
          </label>
          <input id="name" name="name" required maxLength={120} className="input" defaultValue={org.name} disabled={disabled} />
        </div>
        <div>
          <label className="label" htmlFor="businessType">
            Type
          </label>
          <select id="businessType" name="businessType" className="input" defaultValue={org.business_type} disabled={disabled}>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="city">
            City
          </label>
          <input id="city" name="city" maxLength={60} className="input" defaultValue={org.city ?? ""} disabled={disabled} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="alertEmail">
            Alert email
          </label>
          <input id="alertEmail" name="alertEmail" type="email" className="input" defaultValue={org.alert_email ?? ""} disabled={disabled} />
        </div>
        <div>
          <label className="label" htmlFor="negativeThreshold">
            Send an urgent alert for
          </label>
          <select id="negativeThreshold" name="negativeThreshold" className="input" defaultValue={String(org.negative_threshold)} disabled={disabled}>
            <option value="1">1 star reviews</option>
            <option value="2">2 stars or lower</option>
            <option value="3">3 stars or lower</option>
            <option value="4">4 stars or lower</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="weeklyDigest" defaultChecked={org.weekly_digest} className="size-4 accent-brand-700" disabled={disabled} />
        Email me the weekly post draft every Monday
      </label>
      {!disabled && (
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <Status state={state} />
        </div>
      )}
    </form>
  );
}
