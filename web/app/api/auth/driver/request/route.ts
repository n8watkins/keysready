import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createMagicToken, countRecentMagicTokens } from "@/lib/store";
import { sendMagicLink } from "@/lib/email";
import { canonicalOrigin } from "@/lib/app-url";

export const dynamic = "force-dynamic";

// Loose but real email shape check. Not RFC-perfect — just enough to reject
// obvious junk before we mint a token.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 20 * 60 * 1000; // 20 minutes

// POST /api/auth/driver/request  { email }
// ALWAYS returns 200 {ok:true} — no account enumeration. We never reveal whether
// the email exists; the link is only ever delivered to the inbox (or, in dev,
// printed to the server console by lib/email.ts).
export async function POST(req: Request) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    // Even malformed input returns ok (don't leak parse vs. validation paths).
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    // Invalid shape: still 200 so a caller can't probe validity by status code.
    return NextResponse.json({ ok: true });
  }

  try {
    // Rate limit: cap magic links per email (15-min window) so an inbox can't be
    // bombed and Resend can't be cost-amplified. Still returns ok (non-enumerating).
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
    await sendMagicLink(email, link);
  } catch (err) {
    // DB failure: log it but still return ok so timing/existence isn't leaked.
    console.error("[auth:driver:request] failed:", err);
  }

  return NextResponse.json({ ok: true });
}
