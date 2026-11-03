import { NextResponse } from 'next/server';
import { createBooking, listBookings, DEMO_SHOP_ID } from '@/lib/store';
import { notifyNewBooking } from '@/lib/notifications';
import { requireStaff, isUnauthorized } from '@/lib/auth';
import type { NewBookingInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET /api/bookings — staff dashboard list (auth required, scoped to the
// authenticated shop only).
export async function GET() {
  let shopId: string;
  try {
    const session = await requireStaff();
    shopId = session.shopId;
  } catch (err) {
    if (isUnauthorized(err)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw err;
  }

  try {
    return NextResponse.json({ bookings: await listBookings(shopId) });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
}

// Per-field maximum lengths. Reject anything longer rather than silently
// truncating so the customer knows their input was rejected.
const MAX_LEN: Record<string, number> = {
  firstName: 80,
  lastName: 80,
  phone: 32,
  email: 120,
  vehicle: 120,
  issue: 2000,
};

// POST /api/bookings — create a booking (PUBLIC customer) + notify staff.
// Always scoped to the demo shop; the client can never choose its own shopId.
export async function POST(req: Request) {
  let body: Partial<NewBookingInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const required: (keyof NewBookingInput)[] = [
    'firstName', 'lastName', 'phone', 'vehicle', 'issue', 'preferredDate',
  ];
  const missing = required.filter((k) => !body[k] || String(body[k]).trim() === '');
  if (missing.length) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(', ')}` },
      { status: 400 },
    );
  }

  // Length validation (email is optional but capped when provided).
  for (const [field, max] of Object.entries(MAX_LEN)) {
    const raw = body[field as keyof NewBookingInput];
    if (raw != null && String(raw).trim().length > max) {
      return NextResponse.json(
        { error: `${field} must be at most ${max} characters` },
        { status: 400 },
      );
    }
  }

  let booking;
  try {
    booking = await createBooking({
      shopId: DEMO_SHOP_ID, // never trust a client-supplied shopId
      firstName: String(body.firstName).trim(),
      lastName: String(body.lastName).trim(),
      phone: String(body.phone).trim(),
      email: body.email ? String(body.email).trim() : undefined,
      vehicle: String(body.vehicle).trim(),
      issue: String(body.issue).trim(),
      preferredDate: String(body.preferredDate).trim(),
    });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }

  // Awaited (not fire-and-forget): serverless would kill a detached promise.
  // A push failure must NOT fail the booking, so swallow notify errors.
  let notified;
  try {
    notified = await notifyNewBooking(booking);
  } catch {
    notified = { attempted: 0, sent: 0, expiredRemoved: 0 };
  }

  return NextResponse.json({ booking, notified }, { status: 201 });
}
