// Cloudflare Turnstile: the bot check on the public forms (booking and driver
// sign-in). The browser renders the widget with the site key and sends the
// token it gets; the server verifies that token with Siteverify before it
// writes or sends anything.
//
// Fails closed: in production a missing secret refuses every request. Outside
// production (next dev, vitest) a missing key falls back to Cloudflare's
// documented always-pass test keys, so local work needs no account.
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's documented test keys. Test secrets accept the dummy token only. */
export const TEST_KEYS = {
  siteAlwaysPasses: "1x00000000000000000000AA",
  siteAlwaysFails: "2x00000000000000000000AB",
  secretAlwaysPasses: "1x0000000000000000000000000000000AA",
  secretAlwaysFails: "2x0000000000000000000000000000000AA",
  /** The token the test site keys produce. Real secrets reject it. */
  dummyToken: "XXXX.DUMMY.TOKEN.XXXX",
} as const;

/** Siteverify answers test secrets with this hostname, whatever the page was. */
const TEST_HOSTNAME = "example.com";

/** The actions the widgets declare, checked against the token. */
export type TurnstileAction = "booking" | "driver-signin";

type Env = Record<string, string | undefined>;

function isProduction(env: Env): boolean {
  return env.NODE_ENV === "production";
}

/** The public site key for the widget, or null when production has none. */
export function turnstileSiteKey(env: Env = process.env): string | null {
  return env.TURNSTILE_SITE_KEY || (isProduction(env) ? null : TEST_KEYS.siteAlwaysPasses);
}

/**
 * The secret for Siteverify, or null when production has none (refuse). A
 * test secret passes a dummy token, so production refuses one too unless
 * TURNSTILE_ALLOW_TEST_KEYS=true (the e2e script's `next start` build only).
 */
export function turnstileSecret(env: Env = process.env): string | null {
  const secret = env.TURNSTILE_SECRET_KEY || (isProduction(env) ? null : TEST_KEYS.secretAlwaysPasses);
  if (secret && isProduction(env) && isTestSecret(secret) && env.TURNSTILE_ALLOW_TEST_KEYS !== "true") {
    return null;
  }
  return secret;
}

export function isTestSecret(secret: string): boolean {
  return /^[123]x0+A[AB]$/.test(secret);
}

/**
 * Hostnames a token may come from: the canonical app host, plus localhost
 * outside production. Production never accepts a localhost token, so a
 * challenge solved on someone's own machine can't be replayed against it.
 */
export function allowedHostnames(env: Env = process.env): string[] {
  const hosts = new Set<string>();
  if (env.APP_URL) {
    try {
      hosts.add(new URL(env.APP_URL).hostname);
    } catch {
      // A malformed APP_URL allows no host here, which fails closed.
    }
  }
  if (!isProduction(env)) {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
  }
  return [...hosts];
}

export type TurnstileResult =
  | { ok: true }
  | {
      ok: false;
      /** missing_secret is ours (503); the rest mean the caller failed the check (403). */
      reason: "missing_secret" | "missing_token" | "rejected" | "hostname" | "action" | "unavailable";
      codes?: string[];
    };

interface SiteverifyResponse {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

/** Verify one widget token with Siteverify. Never throws. */
export async function verifyTurnstile(
  token: unknown,
  opts: {
    action: TurnstileAction;
    remoteIp?: string | null;
    secret?: string | null;
    hostnames?: string[];
    fetchImpl?: typeof fetch;
  },
): Promise<TurnstileResult> {
  const secret = opts.secret === undefined ? turnstileSecret() : opts.secret;
  if (!secret) return { ok: false, reason: "missing_secret" };
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return { ok: false, reason: "missing_token" };
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (opts.remoteIp) form.append("remoteip", opts.remoteIp);

  let data: SiteverifyResponse;
  try {
    const res = await (opts.fetchImpl ?? fetch)(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = (await res.json()) as SiteverifyResponse;
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (data.success !== true) {
    return { ok: false, reason: "rejected", codes: data["error-codes"] ?? [] };
  }
  // Test secrets report example.com and no action, so these checks apply to
  // real keys only; turnstileSecret() keeps test secrets out of production.
  if (isTestSecret(secret)) {
    return data.hostname === TEST_HOSTNAME ? { ok: true } : { ok: false, reason: "hostname" };
  }
  const hosts = opts.hostnames ?? allowedHostnames();
  if (!data.hostname || !hosts.includes(data.hostname)) return { ok: false, reason: "hostname" };
  if (data.action !== opts.action) return { ok: false, reason: "action" };
  return { ok: true };
}

/** The client IP Cloudflare saw, for Siteverify and the per-IP caps. */
export function clientIp(req: Request): string | null {
  return req.headers.get("cf-connecting-ip") ?? null;
}
