import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createMagicToken, countRecentMagicTokens } from "@/lib/store";
import { sendMagicLink } from "@/lib/email";
import { canonicalOrigin } from "@/lib/app-url";
import { guardPublicForm } from "@/lib/public-guard";

export const dynamic = "force-dynamic";

// Loose but real email shape check. Not RFC-perfect — just enough to reject
// obvious junk before we mint a token.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 20 * 60 * 1000; // 20 minutes

// POST /api/auth/driver/request  { email, turnstileToken }
// A request without a valid Turnstile token (403) or past today's caps (429) is
// refused first (lib/public-guard.ts); neither says anything about the email.
// Past that it ALWAYS returns 200 {ok:true}: no account enumeration. We never
// reveal whether the email exists; the link is only ever delivered to the inbox
// (or, in dev, printed to the server console by lib/email.ts).
export async function POST(req: Request) {
  let body: { email?: unknown; turnstileToken?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const refused = await guardPublicForm(req, "driver-signin", body.turnstileToken);
  if (refused) return refused;

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    // Invalid shape: still 200 so a caller can't probe validity by status code.
    return NextResponse.json({ ok: true });
  }

  try {
    // Rate limit: cap magic links per email (15-min window) so one inbox can't be
    // bombed; the guard above caps per IP and site-wide, and the mailroom caps
    // the mail itself. Still returns ok (non-enumerating).
    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    if ((await countRecentMagicTokens(email, windowStart)) >= 5) {
      return NextResponse.json({ ok: true });
    }

    const id = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    await createMagicToken({ id, email, expiresAt });

    // Build the link on the TRUSTED canonical origin — never on a header the
    // requester can forge (that would point a real email at an attacker).
    const link = new URL(
      `/api/auth/driver/verify?token=${id}`,
      canonicalOrigin(req),
    ).toString();

    // sendMagicLink never throws (dev fallback logs the link); awaited so a
    // serverless function doesn't get torn down before the send completes.
    await sendMagicLink(email, link, id);
  } catch (err) {
    // DB failure: log it but still return ok so timing/existence isn't leaked.
    console.error("[auth:driver:request] failed:", err);
  }

  return NextResponse.json({ ok: true });
}
