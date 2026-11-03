import { NextResponse } from "next/server";
import {
  createSession,
  sessionExpiry,
  setSessionCookie,
  verifyPassword,
  type SessionPayload,
} from "@/lib/auth";
import { getUserByEmail } from "@/lib/store";

export const dynamic = "force-dynamic";

// One generic failure for every rejection path (bad JSON, unknown email, wrong
// password) so an attacker can't enumerate which emails exist.
function unauthorized() {
  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
}

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return unauthorized();
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return unauthorized();

  let user;
  try {
    user = await getUserByEmail(email);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Always run verifyPassword against a real (or sentinel) hash so the response
  // time doesn't betray whether the email exists.
  const stored = user?.passwordHash ?? "x:0";
  const ok = verifyPassword(password, stored);
  if (!user || !ok) return unauthorized();

  const payload: SessionPayload = {
    shopId: user.shopId,
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: sessionExpiry(),
  };
  await setSessionCookie(createSession(payload));

  return NextResponse.json({ ok: true });
}
