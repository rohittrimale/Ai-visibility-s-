"use client";

import { useState, useTransition } from "react";
import { syncNow } from "./actions";

export function SyncButton({ disabled }: { disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-stone-600">{message}</span>}
      <button
        type="button"
        className="btn-secondary"
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const result = await syncNow();
            setMessage(result.ok ? (result.message ?? "Done.") : result.error);
          })
        }
      >
        {pending ? "Checking Google…" : "Check for new reviews"}
      </button>
    </div>
  );
}
