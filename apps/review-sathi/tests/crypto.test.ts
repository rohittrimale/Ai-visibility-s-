import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, safeEqual, signState, verifyState } from "@/lib/crypto";

const key = randomBytes(32).toString("base64");

describe("encryptSecret / decryptSecret", () => {
  it("round-trips text, including non-ASCII", () => {
    const secret = "1//0g-refresh-token-é-हिंदी";
    const encrypted = encryptSecret(secret, key);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(decryptSecret(encrypted, key)).toBe(secret);
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("rejects tampered data and the wrong key", () => {
    const encrypted = encryptSecret("token", key);
    const parts = encrypted.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(encrypted, randomBytes(32).toString("base64"))).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => encryptSecret("x", randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("signState / verifyState", () => {
  it("accepts a valid, unexpired state", () => {
    const state = signState({ org: "o1", user: "u1", exp: Date.now() + 60_000 }, key);
    expect(verifyState(state, key)).toMatchObject({ org: "o1", user: "u1" });
  });

  it("rejects expired, forged or malformed state", () => {
    expect(verifyState(signState({ org: "o1", exp: Date.now() - 1 }, key), key)).toBeNull();
    const state = signState({ org: "o1", exp: Date.now() + 60_000 }, key);
    const forgedBody = Buffer.from(JSON.stringify({ org: "attacker", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifyState(`${forgedBody}.${state.split(".")[1]}`, key)).toBeNull();
    expect(verifyState("garbage", key)).toBeNull();
  });
});

describe("safeEqual", () => {
  it("compares strings of different lengths safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
