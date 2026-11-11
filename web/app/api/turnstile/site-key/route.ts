import { NextResponse } from "next/server";
import { turnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

// GET /api/turnstile/site-key -> { siteKey }. The widget key is public by
// design; the forms fetch it so it can stay a Worker secret next to the
// secret key. 503 when production has none (the forms then say so).
export async function GET() {
  const siteKey = turnstileSiteKey();
  if (!siteKey) {
    return NextResponse.json({ error: "Verification is not configured" }, { status: 503 });
  }
  return NextResponse.json({ siteKey }, { headers: { "Cache-Control": "no-store" } });
}
