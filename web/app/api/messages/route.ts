// In-app messaging, threaded per booking. A logged-in DRIVER and the booking's
// SHOP staff can message each other over data (NO SMS). Each new message pushes
// the OTHER party (see notifyNewMessage).
//
// AUTHZ: a caller is a party to a booking's thread iff EITHER they hold a STAFF
// session whose shopId === booking.shop_id, OR a DRIVER session whose driverId
// === booking.driver_id. We resolve the booking shop-unscoped, then check
// membership — and return 404 (not 403) to a non-party so we never leak
// existence.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDriverSession } from "@/lib/driver-auth";
import { addMessage, getBookingWithDriverByRef, listMessages } from "@/lib/store";
import { notifyNewMessage } from "@/lib/notifications";
import type { Booking } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 2000;

type Viewer = "shop" | "driver";

interface Resolved {
  booking: Booking;
  driverId?: string;
  you: Viewer;
}

/**
 * Resolve the viewer + booking for a thread, enforcing membership.
 * Returns a NextResponse on failure (401 no session, 404 not-a-party / unknown
 * ref) or the resolved party on success. Throws on DB error so the caller can
 * map it to a 503.
 */
async function resolveParty(ref: string): Promise<Resolved | NextResponse> {
  // Determine the viewer: try staff first, then driver.
  const staff = await getSession();
  const driver = staff ? null : await getDriverSession();
  if (!staff && !driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shop-unscoped lookup, then check membership ourselves.
  const found = await getBookingWithDriverByRef(ref);

  // Generic 404 for non-parties and unknown refs alike (don't leak existence).
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { booking, driverId } = found;

  if (staff && staff.shopId === booking.shopId) {
    return { booking, driverId, you: "shop" };
  }
  if (driver && driverId && driver.driverId === driverId) {
    return { booking, driverId, you: "driver" };
  }
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// GET /api/messages?ref=BK-XXXX
//   -> { you: 'shop'|'driver', messages: [{ id, sender, body, createdAt }] } oldest-first
export async function GET(req: Request) {
  const ref = new URL(req.url).searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  let resolved: Resolved | NextResponse;
  try {
    resolved = await resolveParty(ref);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
  if (resolved instanceof NextResponse) return resolved;

  try {
    const messages = await listMessages(resolved.booking.ref);
    return NextResponse.json({
      you: resolved.you,
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        body: m.body,
        createdAt: m.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}

// POST /api/messages  { ref, body }
//   sender = 'shop' if the staff-party, else 'driver'. Inserts the message, then
//   pushes the OTHER party. -> { message }
export async function POST(req: Request) {
  let raw: { ref?: unknown; body?: unknown };
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ref = typeof raw.ref === "string" ? raw.ref.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }
  if (!body) {
    return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });
  }
  if (body.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Message must be at most ${MAX_BODY} characters` },
      { status: 400 },
    );
  }

  let resolved: Resolved | NextResponse;
  try {
    resolved = await resolveParty(ref);
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
  if (resolved instanceof NextResponse) return resolved;

  const { booking, driverId, you } = resolved;
  let message;
  try {
    message = await addMessage({
      bookingRef: booking.ref,
      shopId: booking.shopId,
      driverId: driverId ?? null,
      sender: you,
      body,
    });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Push the OTHER party. A push failure must NOT fail the message send.
  try {
    await notifyNewMessage({ ...booking, driverId }, you, body);
  } catch {
    /* non-fatal: the message is already persisted */
  }

  return NextResponse.json({ message }, { status: 201 });
}
