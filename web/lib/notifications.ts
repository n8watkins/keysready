// Notification layer: maps booking events -> notifications across channels.
// Today: Web Push. Later: SMS plugs in here behind the same calls (the full
// two-way SMS engine lives in server/src/notifications and shares this shape).

import {
  getBookingWithDriverByRef,
  getCustomerSubscriptions,
  getDriverSubscriptions,
  getStaffSubscriptions,
  removeSubscriptionByEndpoint,
} from './store';
import { sendPush, type PushPayload } from './push';
import { renderNewBookingForStaff, renderStatusMessage } from './templates';
import type { Booking, Message, PushRecord } from './types';

interface NotifyResult {
  attempted: number;
  sent: number;
  expiredRemoved: number;
}

// `driverId` is not part of the public Booking type, but status-change and
// new-message pushes need it to reach a logged-in driver's device. Callers that
// know the driver id pass it alongside the booking.
type BookingWithDriver = Booking & { driverId?: string };

async function fanout(subs: PushRecord[], payload: PushPayload): Promise<NotifyResult> {
  let sent = 0;
  let expiredRemoved = 0;
  await Promise.all(
    subs.map(async (s) => {
      const res = await sendPush(s.subscription, payload);
      if (res.ok) sent += 1;
      if (res.expired) {
        await removeSubscriptionByEndpoint(s.subscription.endpoint);
        expiredRemoved += 1;
      }
    }),
  );
  return { attempted: subs.length, sent, expiredRemoved };
}

/** Tell the shop staff a new booking arrived. */
export async function notifyNewBooking(booking: Booking): Promise<NotifyResult> {
  const subs = await getStaffSubscriptions(booking.shopId);
  const msg = renderNewBookingForStaff(booking);
  return fanout(subs, { ...msg, url: '/dashboard', tag: `new-${booking.ref}` });
}

/** Tell the customer their car's status changed. */
export async function notifyStatusChange(booking: BookingWithDriver): Promise<NotifyResult> {
  // The public-tracking customer subscription(s) keyed to this booking ref...
  const customerSubs = await getCustomerSubscriptions(booking.ref);
  // ...plus the signed-in driver's own device subscription (role='driver'), if
  // this booking belongs to a driver, so they get status pushes too. driverId
  // isn't on the public Booking shape; resolve it from the ref when the caller
  // didn't supply it (e.g. the staff status-update route).
  let driverId = booking.driverId;
  if (!driverId) {
    driverId = (await getBookingWithDriverByRef(booking.ref))?.driverId;
  }
  const driverSubs = driverId ? await getDriverSubscriptions(driverId) : [];
  // A driver tracking their own booking can be registered as BOTH a customer
  // (role='customer', keyed to the ref) and a driver (role='driver') on the same
  // device/endpoint. Dedupe by endpoint so that device gets exactly one push.
  const seen = new Set<string>();
  const subs = [...customerSubs, ...driverSubs].filter((s) => {
    const endpoint = s.subscription.endpoint;
    if (seen.has(endpoint)) return false;
    seen.add(endpoint);
    return true;
  });
  const msg = renderStatusMessage(booking);
  return fanout(subs, {
    ...msg,
    url: `/status?ref=${booking.ref}`,
    tag: `status-${booking.ref}`,
  });
}

/** Truncate a message preview for a push body (push payloads are size-limited). */
function preview(body: string, max = 140): string {
  const trimmed = body.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/**
 * Push the OTHER party when a new in-app message is posted.
 * - sender 'shop'   -> push the driver's device(s): "New message from the shop".
 * - sender 'driver' -> push the shop staff: "New message from <customer>".
 * A push failure must never fail the message send, so callers swallow errors.
 */
export async function notifyNewMessage(
  booking: BookingWithDriver,
  sender: Message['sender'],
  body: string,
): Promise<NotifyResult> {
  if (sender === 'shop') {
    // No driver attached (e.g. a public-customer booking) -> nobody to push.
    if (!booking.driverId) return { attempted: 0, sent: 0, expiredRemoved: 0 };
    const subs = await getDriverSubscriptions(booking.driverId);
    return fanout(subs, {
      title: 'New message from the shop',
      body: preview(body),
      url: '/driver',
      tag: `msg-${booking.ref}`,
    });
  }

  // sender === 'driver' -> notify the shop staff.
  const subs = await getStaffSubscriptions(booking.shopId);
  const customer = `${booking.firstName} ${booking.lastName}`.trim() || 'a customer';
  return fanout(subs, {
    title: `New message from ${customer}`,
    body: preview(body),
    url: '/dashboard',
    tag: `msg-${booking.ref}`,
  });
}

// ---- Quote / payment pushes (V3) ----
// Each step of the money flow pushes the OTHER party. The driverId isn't on the
// public Booking shape, so resolve it from the ref when the caller didn't supply
// it. As with messaging, a push failure must never fail the underlying action —
// callers swallow errors.

/** Tell the driver their estimate is ready to approve. */
export async function notifyQuoteSent(booking: BookingWithDriver): Promise<NotifyResult> {
  let driverId = booking.driverId;
  if (!driverId) {
    driverId = (await getBookingWithDriverByRef(booking.ref))?.driverId;
  }
  if (!driverId) return { attempted: 0, sent: 0, expiredRemoved: 0 };
  const subs = await getDriverSubscriptions(driverId);
  return fanout(subs, {
    title: 'Your estimate is ready — approve to start',
    body: `Estimate for ${booking.vehicle}`,
    url: '/driver',
    tag: `quote-${booking.ref}`,
  });
}

/** Tell the shop staff the driver approved the estimate. */
export async function notifyQuoteApproved(booking: BookingWithDriver): Promise<NotifyResult> {
  const subs = await getStaffSubscriptions(booking.shopId);
  const customer = `${booking.firstName} ${booking.lastName}`.trim() || 'A customer';
  return fanout(subs, {
    title: 'Estimate approved',
    body: `${customer} approved the estimate for ${booking.vehicle}`,
    url: '/dashboard',
    tag: `quote-approved-${booking.ref}`,
  });
}

/** Tell the shop staff a payment came in. */
export async function notifyPaid(booking: BookingWithDriver): Promise<NotifyResult> {
  const subs = await getStaffSubscriptions(booking.shopId);
  const customer = `${booking.firstName} ${booking.lastName}`.trim() || 'A customer';
  return fanout(subs, {
    title: 'Payment received',
    body: `${customer} paid for ${booking.vehicle}`,
    url: '/dashboard',
    tag: `paid-${booking.ref}`,
  });
}
