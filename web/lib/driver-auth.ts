// Auth + session spine for KeysReady DRIVERS (car owners).
//
// This is a SEPARATE auth system from staff (lib/auth.ts): different cookie name
// ('kr_driver' vs 'kr_session'), different require* function, different payload
// shape. A driver cookie must NEVER grant staff access and vice-versa. The only
// thing shared with staff auth is the HMAC signing secret (SESSION_SECRET) and
// the base64url(JSON).hmacHex token shape.
//
// Node.js runtime only (node:crypto is unavailable on the edge) — import this
// from Node-runtime route handlers, never edge middleware.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// FAIL CLOSED: a missing signing secret must crash at import time, not silently
// produce forgeable driver sessions. Mirrors lib/auth.ts.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is not set. Refusing to start with an unsigned driver session (see .env.example).",
  );
}

export const DRIVER_COOKIE = "kr_driver";
const DRIVER_MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days — drivers rarely sign in, keep them in

export interface DriverSessionPayload {
  driverId: string;
  email: string;
  role: "driver";
  exp: number; // unix seconds
}

// ---- Stateless signed sessions (HMAC-SHA256), same shape as staff auth ----

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET!).update(data).digest("hex");
}

/** Build a signed driver token: `base64url(JSON).hmacHex`. */
export function createDriverSession(payload: DriverSessionPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(body)}`;
}

/** Verify a driver token: checks the HMAC (constant-time), role and expiry. */
export function verifyDriverSession(
  token: string | undefined | null,
): DriverSessionPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(body);

  // Constant-time compare of the hex MACs (equal length when well-formed).
  const macBuf = Buffer.from(mac);
  const expBuf = Buffer.from(expected);
  if (macBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(macBuf, expBuf)) return null;

  let payload: DriverSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  // Validate the shape AND the role: a token without role:'driver' is not a
  // driver session (defense-in-depth on top of the distinct cookie name).
  if (
    !payload ||
    payload.role !== "driver" ||
    typeof payload.exp !== "number" ||
    typeof payload.driverId !== "string" ||
    typeof payload.email !== "string"
  ) {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Default expiry timestamp (unix seconds) for a new driver session. */
export function driverSessionExpiry(): number {
  return Math.floor(Date.now() / 1000) + DRIVER_MAX_AGE_SECONDS;
}

// ---- Cookie helpers (Next.js Route Handlers / Server Components) ----

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: DRIVER_MAX_AGE_SECONDS,
});

/** Write the driver cookie (call only from a Route Handler / Server Action). */
export async function setDriverCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(DRIVER_COOKIE, token, cookieOptions());
}

/** Clear the driver cookie. */
export async function clearDriverCookie(): Promise<void> {
  const store = await cookies();
  store.set(DRIVER_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

/** Read + verify the current driver session from the request cookie. */
export async function getDriverSession(): Promise<DriverSessionPayload | null> {
  const store = await cookies();
  return verifyDriverSession(store.get(DRIVER_COOKIE)?.value);
}

/** Sentinel thrown by requireDriver() — map to a 401 in route handlers. */
export class DriverUnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "DriverUnauthorizedError";
  }
}

/** Return the current driver session or throw DriverUnauthorizedError (-> 401). */
export async function requireDriver(): Promise<DriverSessionPayload> {
  const session = await getDriverSession();
  if (!session) throw new DriverUnauthorizedError();
  return session;
}

export function isDriverUnauthorized(
  err: unknown,
): err is DriverUnauthorizedError {
  return err instanceof DriverUnauthorizedError;
}
