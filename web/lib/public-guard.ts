// The gate in front of the public forms' endpoints: a verified Turnstile
// token first, then the durable daily caps (lib/limits.ts). Failed checks
// don't spend the caps, so a bot without tokens can't use up real users' day.

import { NextResponse } from "next/server";
import { clientIp, verifyTurnstile } from "./turnstile";
import { capStore, consumeCap, type CapKind } from "./limits";

const ACTION: Record<CapKind, "booking" | "driver-signin"> = {
  booking: "booking",
  "driver-signin": "driver-signin",
};

/** Returns the refusal to send, or null when the request may go ahead. */
export async function guardPublicForm(
  req: Request,
  kind: CapKind,
  token: unknown,
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  const check = await verifyTurnstile(token, { action: ACTION[kind], remoteIp: ip });
  if (!check.ok) {
    console.warn(JSON.stringify({ event: "turnstile_refused", kind, reason: check.reason, codes: check.codes }));
    if (check.reason === "missing_secret" || check.reason === "unavailable") {
      return NextResponse.json(
        { error: "Verification is unavailable right now. Please try again later." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Please complete the verification check and try again." },
      { status: 403 },
    );
  }

  const cap = await consumeCap(await capStore().catch(() => null), kind, ip);
  if (!cap.ok) {
    console.warn(JSON.stringify({ event: "cap_refused", kind, reason: cap.reason }));
    if (cap.reason === "unavailable") {
      return NextResponse.json({ error: "Service unavailable. Please try again later." }, { status: 503 });
    }
    return NextResponse.json(
      { error: "Too many requests today. Please try again tomorrow or call the shop." },
      { status: 429 },
    );
  }
  return null;
}
