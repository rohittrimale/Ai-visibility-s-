export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

/** POST JSON with a timeout and one retry on 429/5xx. Never logs request bodies or keys. */
export async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  opts: { signal?: AbortSignal; timeoutMs?: number; label: string },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeout = AbortSignal.timeout(opts.timeoutMs ?? 25_000);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal,
      });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      lastErr = new ProviderError(`${opts.label} returned HTTP ${res.status}`, res.status);
      if (!retryable) throw lastErr;
    } catch (e) {
      if (e instanceof ProviderError && !(e.status === 429 || (e.status ?? 0) >= 500)) throw e;
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw lastErr instanceof Error ? lastErr : new ProviderError(`${opts.label} failed`);
}

/** Approximate USD cost from token usage. Prices are per 1M tokens and only need to be roughly right. */
export const cost = (inTok = 0, outTok = 0, inPrice: number, outPrice: number) =>
  (inTok * inPrice + outTok * outPrice) / 1_000_000;
