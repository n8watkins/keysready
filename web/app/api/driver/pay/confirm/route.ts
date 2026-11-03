// Driver confirms a DEMO (sim) payment. SIM ONLY: when Stripe IS configured,
// payment is confirmed by the Stripe webhook instead, so this route refuses
// (400). Marks the booking paid and pushes the shop staff ("Payment received").
//
// AUTHZ: requireDriver + the driver must own the booking (404 otherwise).

import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/driver-auth";
import { getBookingWithDriverByRef, getQuote, markPaid } from "@/lib/store";
import { isStripeConfigured } from "@/lib/payments";
import { notifyPaid } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/driver/pay/confirm  { ref } -> { quote }
export async function POST(req: Request) {
  // SIM-ONLY: with Stripe configured, the webhook is the source of truth.
  if (isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payment is confirmed by Stripe, not this endpoint" },
      { status: 400 },
    );
  }

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
  let driverId: string | undefined;
  let quote;
  try {
    const found = await getBookingWithDriverByRef(ref);
    if (!found || !found.driverId || found.driverId !== session.driverId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    booking = found.booking;
    driverId = found.driverId;

    const current = await getQuote(booking.ref);
    if (current.paymentStatus === "paid") {
      // Idempotent: already paid is a success, return the current quote.
      return NextResponse.json({ quote: current });
    }
    if (current.status !== "approved") {
      return NextResponse.json(
        { error: "Estimate must be approved before paying" },
        { status: 409 },
      );
    }

    // markPaid is conditional (only the real unpaid->paid transition mutates);
    // re-read the resulting quote to return it regardless.
    await markPaid(booking.ref);
    quote = await getQuote(booking.ref);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Push the staff. A push failure must NOT fail the payment.
  try {
    await notifyPaid({ ...booking, driverId });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ quote });
}
