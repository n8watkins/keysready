// Per-status notification copy. Shared by Web Push now and SMS later (same text).
// No URL shorteners (carriers filter them); keep transactional, no promo content.

import type { Booking, BookingStatus } from './types';

interface Rendered {
  title: string;
  body: string;
}

function firstName(b: Booking) {
  return b.firstName || 'there';
}

export function renderStatusMessage(b: Booking): Rendered {
  const v = b.vehicle;
  const ref = b.ref;
  switch (b.status) {
    case 'PENDING':
      return {
        title: 'Booking received',
        body: `Hi ${firstName(b)}, we received your request for your ${v} (ref ${ref}). We'll confirm shortly.`,
      };
    case 'CONFIRMED':
      return {
        title: 'Appointment confirmed',
        body: `Your appointment for the ${v} is CONFIRMED (ref ${ref}). See you soon!`,
      };
    case 'IN_PROGRESS':
      return {
        title: 'Work started',
        body: `Good news ${firstName(b)} — our techs have started work on your ${v} (ref ${ref}).`,
      };
    case 'READY':
      return {
        title: 'Your car is ready! 🚗',
        body: `Your ${v} is READY for pickup (ref ${ref}). See you soon!`,
      };
    case 'COMPLETED':
      return {
        title: 'Service complete',
        body: `Thanks ${firstName(b)}! Service on your ${v} is complete (ref ${ref}). Drive safe!`,
      };
    case 'CANCELLED':
      return {
        title: 'Booking cancelled',
        body: `Your booking for the ${v} (ref ${ref}) has been cancelled. Reply or call us to rebook.`,
      };
  }
}

export function renderNewBookingForStaff(b: Booking): Rendered {
  return {
    title: 'New booking 🔔',
    body: `${b.firstName} ${b.lastName} — ${b.vehicle}: ${b.issue} (ref ${b.ref})`,
  };
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In progress',
  READY: 'Ready for pickup',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
