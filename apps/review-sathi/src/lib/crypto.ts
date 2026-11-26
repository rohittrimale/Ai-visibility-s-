import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored in the database (Google tokens).
 * Key: 32 bytes, base64 encoded (generate with `openssl rand -base64 32`).
 * Output format: v1.<iv>.<tag>.<ciphertext>, each part base64url.
 */
function loadKey(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded");
  }
  return key;
}

export function encryptSecret(plaintext: string, keyB64: string): string {
  const key = loadKey(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, keyB64: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error("Unrecognised encrypted payload");
  }
  const key = loadKey(keyB64);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString("utf8");
}

/** Constant-time string comparison (for signatures and secrets). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function hmacSha256Hex(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

/** Signed, expiring state for OAuth redirects, so the callback can trust the org id. */
export function signState(payload: Record<string, string | number>, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmacSha256Hex(body, secret)}`;
}

export function verifyState<T extends Record<string, unknown>>(state: string, secret: string): T | null {
  const [body, sig] = state.split(".");
  if (!body || !sig || !safeEqual(sig, hmacSha256Hex(body, secret))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof parsed.exp === "number" && parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
