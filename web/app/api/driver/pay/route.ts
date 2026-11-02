// Driver pays for an approved estimate. Requires quote_status === 'approved' and
// the booking still unpaid. Creates a checkout:
//   - Stripe configured -> { mode:'stripe', url } (the client redirects to it).
//   - Otherwise (demo)   -> { mode:'sim' } (the client confirms via /pay/confirm).
//
// AUTHZ: requireDriver + the driver must own the booking (404 otherwise).
// All amounts are INTEGER CENTS.

import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/driver-auth";
import { getBookingWithDriverByRef, getQuote, setBookingSessionId } from "@/lib/store";
import { createCheckout } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/driver/pay  { ref } -> { mode:'stripe', url } | { mode:'sim' }
export async function POST(req: Request) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: { ref?: unknown };
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const ref = typeof raw.ref === "string" ? raw.ref.trim() : "";
  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  let booking;
  let quote;
  try {
    const found = await getBookingWithDriverByRef(ref);
    if (!found || !found.driverId || found.driverId !== session.driverId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    booking = found.booking;
    quote = await getQuote(booking.ref);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  if (quote.paymentStatus === "paid") {
    return NextResponse.json({ error: "Already paid" }, { status: 409 });
  }
  if (quote.status !== "approved") {
    return NextResponse.json(
      { error: "Estimate must be approved before paying" },
      { status: 409 },
    );
  }
  if (quote.items.length === 0 || quote.totalCents <= 0) {
    return NextResponse.json({ error: "Nothing to pay" }, { status: 400 });
  }

  // Build absolute success/cancel URLs from the request origin.
  const origin = new URL(req.url).origin;

  try {
    const result = await createCheckout({
      bookingRef: booking.ref,
      items: quote.items.map((it) => ({
        description: it.description,
        amount_cents: it.amountCents,
      })),
      totalCents: quote.totalCents,
      successUrl: `${origin}/driver?paid=1`,
      cancelUrl: `${origin}/driver`,
    });
    // Record the Stripe Checkout Session id so the payment flow can correlate it.
    if (result.mode === "stripe") {
      await setBookingSessionId(booking.ref, result.sessionId);
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}
