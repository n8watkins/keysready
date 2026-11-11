import { describe, expect, it } from "vitest";
import {
  TEST_KEYS,
  allowedHostnames,
  turnstileSecret,
  turnstileSiteKey,
  verifyTurnstile,
} from "../lib/turnstile";

function siteverify(body: Record<string, unknown>, ok = true): typeof fetch {
  return (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as typeof fetch;
}

const REAL = "0x4AAAAAAAreal_secret_value_for_tests";
const HOSTS = ["app.keysready.n8builds.dev"];

describe("keys", () => {
  it("falls back to Cloudflare's test keys outside production", () => {
    expect(turnstileSiteKey({ NODE_ENV: "development" })).toBe(TEST_KEYS.siteAlwaysPasses);
    expect(turnstileSecret({ NODE_ENV: "test" })).toBe(TEST_KEYS.secretAlwaysPasses);
  });

  it("has no fallback in production, and refuses a test secret there", () => {
    expect(turnstileSiteKey({ NODE_ENV: "production" })).toBeNull();
    expect(turnstileSecret({ NODE_ENV: "production" })).toBeNull();
    expect(turnstileSecret({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: TEST_KEYS.secretAlwaysPasses })).toBeNull();
    expect(
      turnstileSecret({
        NODE_ENV: "production",
        TURNSTILE_SECRET_KEY: TEST_KEYS.secretAlwaysPasses,
        TURNSTILE_ALLOW_TEST_KEYS: "true",
      }),
    ).toBe(TEST_KEYS.secretAlwaysPasses);
    expect(turnstileSecret({ NODE_ENV: "production", TURNSTILE_SECRET_KEY: REAL })).toBe(REAL);
  });

  it("allows localhost only outside production", () => {
    expect(allowedHostnames({ NODE_ENV: "production", APP_URL: "https://app.keysready.n8builds.dev" })).toEqual(HOSTS);
    expect(allowedHostnames({ NODE_ENV: "development" })).toContain("localhost");
    expect(allowedHostnames({ NODE_ENV: "production", APP_URL: "not a url" })).toEqual([]);
  });
});

describe("verifyTurnstile", () => {
  const base = { action: "booking" as const, secret: REAL, hostnames: HOSTS };

  it("fails closed without a secret", async () => {
    expect(await verifyTurnstile("t", { ...base, secret: null })).toEqual({ ok: false, reason: "missing_secret" });
  });

  it("refuses a missing or oversized token without calling Siteverify", async () => {
    const fetchImpl = (async () => { throw new Error("must not be called"); }) as typeof fetch;
    expect((await verifyTurnstile(undefined, { ...base, fetchImpl })).ok).toBe(false);
    expect((await verifyTurnstile("", { ...base, fetchImpl })).ok).toBe(false);
    expect((await verifyTurnstile("x".repeat(3000), { ...base, fetchImpl })).ok).toBe(false);
  });

  it("accepts a token for the right host and action", async () => {
    const fetchImpl = siteverify({ success: true, hostname: HOSTS[0], action: "booking" });
    expect(await verifyTurnstile("t", { ...base, fetchImpl })).toEqual({ ok: true });
  });

  it("refuses a rejected token", async () => {
    const fetchImpl = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    expect(await verifyTurnstile("t", { ...base, fetchImpl })).toMatchObject({ ok: false, reason: "rejected" });
  });

  it("refuses a token from another hostname", async () => {
    const fetchImpl = siteverify({ success: true, hostname: "evil.example", action: "booking" });
    expect(await verifyTurnstile("t", { ...base, fetchImpl })).toMatchObject({ ok: false, reason: "hostname" });
  });

  it("refuses a token for another action", async () => {
    const fetchImpl = siteverify({ success: true, hostname: HOSTS[0], action: "driver-signin" });
    expect(await verifyTurnstile("t", { ...base, fetchImpl })).toMatchObject({ ok: false, reason: "action" });
  });

  it("fails closed when Siteverify errors or is unreachable", async () => {
    expect(await verifyTurnstile("t", { ...base, fetchImpl: siteverify({}, false) })).toMatchObject({
      ok: false,
      reason: "unavailable",
    });
    const down = (async () => { throw new Error("offline"); }) as typeof fetch;
    expect(await verifyTurnstile("t", { ...base, fetchImpl: down })).toMatchObject({ reason: "unavailable" });
  });

  it("passes Cloudflare's always-pass test secret with the dummy token (example.com)", async () => {
    const fetchImpl = siteverify({ success: true, hostname: "example.com" });
    expect(
      await verifyTurnstile(TEST_KEYS.dummyToken, { ...base, secret: TEST_KEYS.secretAlwaysPasses, fetchImpl }),
    ).toEqual({ ok: true });
  });

  it("refuses with Cloudflare's always-fail test secret", async () => {
    const fetchImpl = siteverify({ success: false, "error-codes": ["invalid-input-response"] });
    expect(
      await verifyTurnstile(TEST_KEYS.dummyToken, { ...base, secret: TEST_KEYS.secretAlwaysFails, fetchImpl }),
    ).toMatchObject({ ok: false, reason: "rejected" });
  });
});
