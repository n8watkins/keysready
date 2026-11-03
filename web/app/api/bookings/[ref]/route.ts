import { NextResponse } from 'next/server';
import {
  getBookingByRef,
  updateBookingStatus,
  allowedTransition,
} from '@/lib/store';
import { notifyStatusChange } from '@/lib/notifications';
import { requireStaff, isUnauthorized } from '@/lib/auth';
import { BOOKING_STATUSES, type Booking, type BookingStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const onlyDigits = (s: string) => s.replace(/\D/g, '');

// What a public (unauthenticated) caller is allowed to see. Deliberately omits
// email, issue, full phone, last name, shopId, timestamps.
function publicProjection(b: Booking) {
  return {
    ref: b.ref,
    vehicle: b.vehicle,
    status: b.status,
    etaDate: b.etaDate,
    firstName: b.firstName,
  };
}

// GET /api/bookings/:ref?phone=...  — PUBLIC customer status lookup.
// Phone is MANDATORY and must match the booking's FULL normalized number.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;

  const phone = new URL(req.url).searchParams.get('phone');
  if (!phone || !phone.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }

  let booking: Booking | undefined;
  try {
    booking = await getBookingByRef(ref);
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }

  const suppliedDigits = onlyDigits(phone);
  // Generic 404 whether the ref is unknown or the phone doesn't match — don't
  // confirm a ref exists to someone who can't prove they own it. Compare the
  // FULL normalized number (not last-4) in constant-ish time.
  if (!booking || !suppliedDigits || onlyDigits(booking.phone) !== suppliedDigits) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  return NextResponse.json({ booking: publicProjection(booking) });
}

// PATCH /api/bookings/:ref — staff updates status (auth required, scoped to the
// authenticated shop) + notifies the customer on a real change.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ ref: string }> },
) {
  const { ref } = await params;

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

  let body: { status?: string; etaDate?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = body.status as BookingStatus | undefined;
  if (!status || !BOOKING_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${BOOKING_STATUSES.join(', ')}` },
      { status: 400 },
    );
  }

  try {
    // Scope the read to the session's shop so a shop can't see/touch another's.
    const existing = await getBookingByRef(ref, shopId);
    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Enforce the state machine. Illegal jumps are a 409 (conflict), not a 400.
    if (!allowedTransition(existing.status, status)) {
      return NextResponse.json(
        { error: `Cannot move from ${existing.status} to ${status}` },
        { status: 409 },
      );
    }

    // Same status (and no ETA change) → no-op write, and skip the notification.
    const unchanged =
      existing.status === status &&
      (body.etaDate === undefined || body.etaDate === '');
    if (unchanged) {
      return NextResponse.json({
        booking: existing,
        notified: { attempted: 0, sent: 0, expiredRemoved: 0 },
      });
    }

    const updated = await updateBookingStatus(ref, shopId, status, body.etaDate);
    if (!updated) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Skip the customer notify when the status didn't actually change.
    let notified = { attempted: 0, sent: 0, expiredRemoved: 0 };
    if (existing.status !== status) {
      try {
        notified = await notifyStatusChange(updated);
      } catch {
        /* a push failure must not fail the status update */
      }
    }

    return NextResponse.json({ booking: updated, notified });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
}
