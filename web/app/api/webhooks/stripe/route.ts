// Stripe webhook — only meaningful when Stripe is configured. Reads the RAW body
// and the 'stripe-signature' header, verifies the event, and on
// 'checkout.session.completed' marks the booking paid + pushes the shop staff.
//
// We must NOT consume req.json() here: signature verification requires the exact
// raw bytes, so we read req.text(). Always return 200 to Stripe on success so it
// stops retrying.

import { NextResponse } from "next/server";
import {
  getBookingWithDriverByRef,
  getQuote,
  isEventProcessed,
  markEventProcessed,
  markPaid,
} from "@/lib/store";
import { isStripeConfigured, verifyStripeWebhook } from "@/lib/payments";
import { notifyPaid } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/webhooks/stripe
export async function POST(req: Request) {
  // Without Stripe configured there is no webhook to honor.
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  // RAW body (exact bytes) — required for signature verification.
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let event;
  try {
    event = await verifyStripeWebhook(rawBody, sig);
  } catch {
    // Bad signature / malformed payload — reject so Stripe doesn't keep retrying
    // a payload we can't trust.
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    // (1) Fast-path dedup — READ ONLY. We commit the event id only at the very
    // end, AFTER the payment is recorded. Recording it up front (as before) meant
    // a transient DB error in the window below returned 503 for a retry, but the
    // dedup row was already persisted, so the retry short-circuited here and the
    // real payment was silently never marked paid.
    try {
      if (await isEventProcessed(event.id)) {
        return NextResponse.json({ received: true, deduped: true });
      }
    } catch (err) {
      console.error(`[stripe webhook] dedup check failed for event ${event.id}:`, err);
      return NextResponse.json({ error: "processing error" }, { status: 503 });
    }

    const session = event.data.object;
    const bookingRef = session?.metadata?.bookingRef;
    if (!bookingRef) {
      // Nothing to mark; acknowledge so Stripe stops retrying.
      return NextResponse.json({ received: true });
    }

    // (2) Verify the session BEFORE trusting it. The booking's quote total is the
    // source of truth for the expected amount. A mismatch (tampering, wrong
    // currency, unpaid session) is LOGGED and acknowledged WITHOUT marking paid.
    let found;
    let quote;
    try {
      found = await getBookingWithDriverByRef(bookingRef);
      quote = await getQuote(bookingRef);
    } catch (err) {
      // Transient DB error -> let Stripe retry. Nothing has been persisted yet
      // (the event id is recorded only after markPaid), so the retry reprocesses.
      console.error(`[stripe webhook] ${bookingRef}: read failed, asking Stripe to retry:`, err);
      return NextResponse.json({ error: "processing error" }, { status: 503 });
    }

    if (!found) {
      console.warn(`[stripe webhook] no booking for ref=${bookingRef}; ignoring`);
      return NextResponse.json({ received: true });
    }
    if (session.payment_status !== "paid") {
      console.warn(
        `[stripe webhook] ${bookingRef}: session payment_status=${session.payment_status} (not paid); ignoring`,
      );
      return NextResponse.json({ received: true });
    }
    if (session.currency !== "usd") {
      console.warn(
        `[stripe webhook] ${bookingRef}: unexpected currency=${session.currency}; ignoring`,
      );
      return NextResponse.json({ received: true });
    }
    if (session.amount_total !== quote.totalCents) {
      console.warn(
        `[stripe webhook] ${bookingRef}: amount_total=${session.amount_total} != quote total=${quote.totalCents}; ignoring`,
      );
      return NextResponse.json({ received: true });
    }

    // (3) All checks passed. markPaid is conditional: it returns true only on the
    // real unpaid->paid transition, so a replay/already-paid booking never
    // re-pushes the staff.
    let transitioned: boolean;
    try {
      transitioned = await markPaid(bookingRef);
    } catch (err) {
      console.error(`[stripe webhook] ${bookingRef}: markPaid failed, asking Stripe to retry:`, err);
      return NextResponse.json({ error: "processing error" }, { status: 503 });
    }
    if (transitioned) {
      // Push the staff. A push failure must NOT make Stripe retry a payment we
      // already recorded.
      try {
        await notifyPaid({ ...found.booking, driverId: found.driverId });
      } catch {
        /* non-fatal */
      }
    }

    // (4) Record the event id ONLY now — after the payment is durably marked.
    // Best-effort: markPaid is idempotent, so if this write fails a Stripe
    // redelivery simply re-runs the (no-op) markPaid and re-records. This is the
    // crucial ordering fix — a failure before here never strands a paid booking.
    try {
      await markEventProcessed(event.id);
    } catch (err) {
      console.warn(
        `[stripe webhook] ${bookingRef}: failed to record event id ${event.id} (non-fatal):`,
        err,
      );
    }
  }

  // Acknowledge everything else (and successful processing) with a 200.
  return NextResponse.json({ received: true });
}
