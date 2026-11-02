// Auth + session spine for KeysReady (staff dashboard).
//
// No external deps and no Google — uses Node's built-in `crypto` and Next's
// cookie store. Runs ONLY on the Node.js runtime (route handlers + server
// components). DO NOT import this from edge middleware: node:crypto is
// unavailable on the edge, which is why auth is enforced inside Node-runtime
// route handlers instead of a middleware.ts.

import {
  scryptSync,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "crypto";
import { cookies } from "next/headers";

// FAIL CLOSED: a missing signing secret must crash the process at import time,
// not silently produce forgeable sessions.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is not set. Refusing to start with an unsigned session (see .env.example).",
  );
}

export const SESSION_COOKIE = "kr_session";
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const SCRYPT_KEYLEN = 64;

export type StaffRole = "owner" | "staff";

export interface SessionPayload {
  shopId: string;
  userId: string;
  email: string;
  role: string;
  exp: number; // unix seconds
}

// ---- Password hashing (scrypt) ----

/** Hash a plaintext password as `salt:hashHex` (hex salt, hex derived key). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

/** Constant-time verify of a plaintext password against a stored `salt:hashHex`. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== SCRYPT_KEYLEN) return false;
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  // Both buffers are guaranteed equal length here, so timingSafeEqual is safe.
  return timingSafeEqual(actual, expected);
}

// ---- Stateless signed sessions (HMAC-SHA256) ----

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", SESSION_SECRET!).update(data).digest("hex");
}

/** Build a signed session token: `base64url(JSON).hmacHex`. */
export function createSession(payload: SessionPayload): string {
  const body = base64url(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(body)}`;
}

/** Verify a session token: checks the HMAC (constant-time) and expiry. */
export function verifySession(token: string | undefined | null): SessionPayload | null {
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

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.exp !== "number" ||
    typeof payload.shopId !== "string" ||
    typeof payload.userId !== "string"
  ) {
    return null;
  }
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

/** Default expiry timestamp (unix seconds) for a new session. */
export function sessionExpiry(): number {
  return Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
}

// ---- Cookie helpers (Next.js Route Handlers / Server Components) ----

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
});

/** Write the session cookie (call only from a Route Handler / Server Action). */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions());
}

/** Clear the session cookie. */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
}

/** Read + verify the current session from the request cookie. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Sentinel thrown by requireStaff() — map to a 401 in route handlers. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Return the current session or throw UnauthorizedError (map to 401). */
export async function requireStaff(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

export function isUnauthorized(err: unknown): err is UnauthorizedError {
  return err instanceof UnauthorizedError;
}
