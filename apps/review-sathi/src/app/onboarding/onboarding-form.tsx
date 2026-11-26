"use client";

import { useActionState } from "react";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { createBusiness, type OnboardingState } from "./actions";

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(createBusiness, { error: null });
  return (
    <form action={action} className="mt-5 space-y-4">
      <div>
        <label htmlFor="name" className="label">
          Business name
        </label>
        <input id="name" name="name" required maxLength={120} className="input" placeholder="Sharma Sweets" />
      </div>
      <div>
        <label htmlFor="businessType" className="label">
          Type of business
        </label>
        <select id="businessType" name="businessType" className="input" defaultValue="restaurant">
          {BUSINESS_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="city" className="label">
          City
        </label>
        <input id="city" name="city" maxLength={60} className="input" placeholder="Pune" />
      </div>
      <div>
        <label htmlFor="alertEmail" className="label">
          Send review alerts to
        </label>
        <input id="alertEmail" name="alertEmail" type="email" className="input" defaultValue={defaultEmail} />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Setting up…" : "Continue"}
      </button>
    </form>
  );
}
