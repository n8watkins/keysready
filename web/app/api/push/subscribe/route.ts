import { NextResponse } from 'next/server';
import { addPushSubscription, getBookingByRef, DEMO_SHOP_ID } from '@/lib/store';
import { requireStaff, isUnauthorized } from '@/lib/auth';
import { requireDriver, isDriverUnauthorized } from '@/lib/driver-auth';
import type { SubscriberRole } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const onlyDigits = (s: string) => s.replace(/\D/g, '');

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { role, bookingRef, phone, subscription } = (body ?? {}) as {
    role?: SubscriberRole;
    bookingRef?: string;
    phone?: string;
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };

  if (role !== 'staff' && role !== 'customer' && role !== 'driver') {
    return NextResponse.json({ error: 'role must be "staff", "customer" or "driver"' }, { status: 400 });
  }
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return NextResponse.json({ error: 'A valid push subscription is required' }, { status: 400 });
  }

  const sub = {
    endpoint: subscription.endpoint,
    keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
  };

  // ---- Driver: must be an authenticated driver; bind to THEIR driver id. ----
  // No bookingRef/phone needed — this is the driver's one device subscription,
  // used to push them in-app messages and status changes.
  if (role === 'driver') {
    let driverId: string;
    try {
      const session = await requireDriver();
      driverId = session.driverId;
    } catch (err) {
      if (isDriverUnauthorized(err)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      throw err;
    }
    try {
      const rec = await addPushSubscription({ role, driverId, shopId: DEMO_SHOP_ID, subscription: sub });
      return NextResponse.json({ ok: true, id: rec.id });
    } catch {
      return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
    }
  }

  // ---- Staff: must be an authenticated staff member; bind to THEIR shop. ----
  if (role === 'staff') {
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
      const rec = await addPushSubscription({ role, shopId, subscription: sub });
      return NextResponse.json({ ok: true, id: rec.id });
    } catch {
      return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
    }
  }

  // ---- Customer: must prove ownership of the booking via bookingRef+phone. ----
  if (!bookingRef || !bookingRef.trim()) {
    return NextResponse.json({ error: 'bookingRef is required for customer subscriptions' }, { status: 400 });
  }
  if (!phone || !phone.trim()) {
    return NextResponse.json({ error: 'phone is required for customer subscriptions' }, { status: 400 });
  }

  let booking;
  try {
    booking = await getBookingByRef(bookingRef);
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }

  const suppliedDigits = onlyDigits(phone);
  // Generic 404 (don't reveal whether the ref exists). Compare the FULL
  // normalized phone — last-4 is not enough to authorize a subscription.
  if (!booking || !suppliedDigits || onlyDigits(booking.phone) !== suppliedDigits) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  try {
    const rec = await addPushSubscription({
      role,
      bookingRef: booking.ref,
      shopId: booking.shopId,
      subscription: sub,
    });
    return NextResponse.json({ ok: true, id: rec.id });
  } catch {
    return NextResponse.json({ error: 'service unavailable' }, { status: 503 });
  }
}
