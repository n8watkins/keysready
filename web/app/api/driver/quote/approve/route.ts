// Driver approves a sent estimate. Only valid when quote_status === 'sent'.
// Moves the quote to 'approved' and pushes the shop staff ("Estimate approved").
//
// AUTHZ: requireDriver + the driver must own the booking (404 otherwise).

import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/driver-auth";
import { approveQuote, getBookingWithDriverByRef, getQuote } from "@/lib/store";
import { notifyQuoteApproved } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// POST /api/driver/quote/approve  { ref } -> { quote }
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
  let driverId: string | undefined;
  let quote;
  try {
    const found = await getBookingWithDriverByRef(ref);
    if (!found || !found.driverId || found.driverId !== session.driverId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    booking = found.booking;
    driverId = found.driverId;

    // Only a 'sent' quote can be approved.
    const current = await getQuote(booking.ref);
    if (current.status !== "sent") {
      return NextResponse.json(
        { error: "Estimate is not awaiting approval" },
        { status: 409 },
      );
    }

    quote = await approveQuote(booking.ref, session.driverId);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Push the staff. A push failure must NOT fail the approval.
  try {
    await notifyQuoteApproved({ ...booking, driverId });
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ quote });
}
