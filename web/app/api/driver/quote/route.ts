// Driver-side read of a booking's quote/estimate.
//
// AUTHZ: requireDriver + the driver must own the booking (driverId === the
// booking's driver_id). 404 (not 403) to a non-owner so we never leak existence.

import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/driver-auth";
import { getBookingWithDriverByRef, getQuote } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/driver/quote?ref=BK-XXXX -> { quote }
export async function GET(req: Request) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ref = new URL(req.url).searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  try {
    const found = await getBookingWithDriverByRef(ref);
    if (!found || !found.driverId || found.driverId !== session.driverId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const quote = await getQuote(found.booking.ref);
    return NextResponse.json({ quote });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}
