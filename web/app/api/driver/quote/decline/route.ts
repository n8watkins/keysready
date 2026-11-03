// Driver declines a sent estimate. Only valid when quote_status === 'sent'.
// Moves the quote to 'declined' and pushes the shop staff.
//
// AUTHZ: requireDriver + the driver must own the booking (404 otherwise).

import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/driver-auth";
import {
  declineQuote,
  getBookingWithDriverByRef,
  getQuote,
  getStaffSubscriptions,
  removeSubscriptionByEndpoint,
} from "@/lib/store";
import { sendPush } from "@/lib/push";

export const dynamic = "force-dynamic";

// POST /api/driver/quote/decline  { ref } -> { quote }
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

    // Only a 'sent' quote can be declined.
    const current = await getQuote(booking.ref);
    if (current.status !== "sent") {
      return NextResponse.json(
        { error: "Estimate is not awaiting approval" },
        { status: 409 },
      );
    }

    quote = await declineQuote(booking.ref, session.driverId);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Notify the shop the estimate was declined. A push failure must NOT fail it.
  try {
    const subs = await getStaffSubscriptions(booking.shopId);
    const customer = `${booking.firstName} ${booking.lastName}`.trim() || "A customer";
    await Promise.all(
      subs.map(async (s) => {
        const res = await sendPush(s.subscription, {
          title: "Estimate declined",
          body: `${customer} declined the estimate for ${booking!.vehicle}`,
          url: "/dashboard",
          tag: `quote-declined-${booking!.ref}`,
        });
        if (res.expired) await removeSubscriptionByEndpoint(s.subscription.endpoint);
      }),
    );
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ quote });
}
