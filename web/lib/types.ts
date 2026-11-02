// Domain types for the Auto Repair Shop product (Next.js rebuild).
// Kept framework-agnostic so they can move to a DB schema (Drizzle/Prisma) later.

export const BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'IN_PROGRESS',
  'READY',
  'COMPLETED',
  'CANCELLED',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface Shop {
  id: string;
  name: string;
}

export interface Booking {
  ref: string; // public reference, e.g. "BK-7F3A2K"
  shopId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  vehicle: string; // "2018 Honda Civic"
  issue: string;
  preferredDate: string; // ISO
  status: BookingStatus;
  etaDate?: string; // ISO
  createdAt: string;
  updatedAt: string;
  // Present on listed bookings (lib/store.listBookings): true when the booking
  // belongs to a signed-in driver (driver_id non-null). Drives whether the
  // dashboard offers the in-app Messages thread. Not set on single-booking reads.
  hasDriver?: boolean;
}

export type SubscriberRole = 'staff' | 'customer' | 'driver';

// A stored Web Push subscription (the browser's PushSubscription.toJSON()).
export interface PushRecord {
  id: string;
  role: SubscriberRole;
  bookingRef?: string; // for customer subscriptions, which booking they track
  driverId?: string; // for driver subscriptions (role='driver'): which driver's device
  shopId: string;
  subscription: PushSubscriptionJSONLike;
  createdAt: string;
}

// An in-app message threaded per booking. Either party (the booking's shop staff
// or the booking's driver) can post; delivered over data with a Web Push to the
// OTHER party. No SMS.
export interface Message {
  id: string;
  bookingRef: string;
  shopId: string;
  driverId?: string;
  sender: 'shop' | 'driver';
  body: string;
  createdAt: string;
}

export interface PushSubscriptionJSONLike {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface NewBookingInput {
  shopId?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  vehicle: string;
  issue: string;
  preferredDate: string;
}
