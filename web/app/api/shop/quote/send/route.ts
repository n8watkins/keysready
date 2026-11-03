// Shop sends a booking's quote to the customer. Moves quote_status -> 'sent' and
// pushes the driver ("Your estimate is ready — approve to start").
//
// AUTHZ: requireStaff + the staff's shopId must own the booking (404 otherwise).
// 400 if the booking has no line items yet.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBookingWithDriverByRef, getQuote, sendQuote } from "@/lib/store";
import { notifyQuoteSent } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/shop/quote/send  { ref } -> { quote }
export async function POST(req: Request) {
  const session = await getSession();
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
    if (!found || found.booking.shopId !== session.shopId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    booking = found.booking;
    driverId = found.driverId;

    // Must have at least one line item to send.
    const current = await getQuote(booking.ref);
    if (current.items.length === 0) {
      return NextResponse.json({ error: "Add at least one line item first" }, { status: 400 });
    }

    // sendQuote is the authoritative gate: it rejects unless status is 'draft'
    // with >=1 item. A non-draft quote (already sent/approved) maps to 409.
    quote = await sendQuote(booking.ref, session.shopId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/only be sent from draft/i.test(msg)) {
      return NextResponse.json({ error: "Quote has already been sent" }, { status: 409 });
    }
    if (/at least one line item/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Push the driver. A push failure must NOT fail the send.
  try {
    await notifyQuoteSent({ ...booking, driverId });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ quote });
}
