// Data access layer (Turso / libSQL). All functions are async.
// Swappable: point DATABASE_URL at a local file (dev) or Turso cloud (prod) — same code.

import { randomBytes } from "crypto";
import { db, ready, type Row } from "./db";
import type {
  Booking,
  BookingStatus,
  Message,
  NewBookingInput,
  PushRecord,
  Shop,
  SubscriberRole,
} from "./types";

export const DEMO_SHOP_ID = "demo-shop";

export interface User {
  id: string;
  shopId: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  createdAt: string;
}

export interface Car {
  id: string;
  driverId: string;
  year?: number;
  make?: string;
  model?: string;
  plate?: string;
  createdAt: string;
}

function str(v: Row[string]): string {
  return v == null ? "" : String(v);
}
function maybe(v: Row[string]): string | undefined {
  return v == null ? undefined : String(v);
}

function rowToBooking(r: Row): Booking {
  return {
    ref: str(r.ref),
    shopId: str(r.shop_id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    phone: str(r.phone),
    email: maybe(r.email),
    vehicle: str(r.vehicle),
    issue: str(r.issue),
    preferredDate: str(r.preferred_date),
    status: str(r.status) as BookingStatus,
    etaDate: maybe(r.eta_date),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
  };
}

function rowToPush(r: Row): PushRecord {
  return {
    id: str(r.id),
    role: str(r.role) as SubscriberRole,
    bookingRef: maybe(r.booking_ref),
    driverId: maybe(r.driver_id),
    shopId: str(r.shop_id),
    subscription: {
      endpoint: str(r.endpoint),
      keys: { p256dh: str(r.p256dh), auth: str(r.auth) },
    },
    createdAt: str(r.created_at),
  };
}

function rowToMessage(r: Row): Message {
  return {
    id: str(r.id),
    bookingRef: str(r.booking_ref),
    shopId: str(r.shop_id),
    driverId: maybe(r.driver_id),
    sender: str(r.sender) as Message["sender"],
    body: str(r.body),
    createdAt: str(r.created_at),
  };
}

function rowToUser(r: Row): User {
  return {
    id: str(r.id),
    shopId: str(r.shop_id),
    email: str(r.email),
    passwordHash: str(r.password_hash),
    role: str(r.role),
    createdAt: str(r.created_at),
  };
}

function randomRef(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `BK-${s}`;
}

function rowToDriver(r: Row): Driver {
  return {
    id: str(r.id),
    email: str(r.email),
    name: maybe(r.name),
    phone: maybe(r.phone),
    createdAt: str(r.created_at),
  };
}

function rowToCar(r: Row): Car {
  return {
    id: str(r.id),
    driverId: str(r.driver_id),
    year: r.year == null ? undefined : Number(r.year),
    make: maybe(r.make),
    model: maybe(r.model),
    plate: maybe(r.plate),
    createdAt: str(r.created_at),
  };
}

function randomId(prefix: string): string {
  // 32 bytes of hex for magic tokens (unguessable); shorter for entity ids.
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

// ---- Status transitions ----
// The only legal moves staff can make. COMPLETED and CANCELLED are terminal.
// A same->same move is always allowed (treated as a no-op by callers).
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** True if `to` is a legal next status from `from` (or unchanged). */
export function allowedTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** The set of statuses staff may move `from` to, including `from` itself. */
export function allowedNextStatuses(from: BookingStatus): BookingStatus[] {
  return [from, ...(TRANSITIONS[from] ?? [])];
}

// ---- Bookings ----
// `driverId` is optional: public customer bookings have none; bookings created
// by a signed-in driver carry their driver id so /api/driver/bookings can list
// them. It is NOT part of the public Booking type, so it's passed alongside.
export async function createBooking(
  input: NewBookingInput,
  driverId?: string,
): Promise<Booking> {
  await ready();
  const ts = new Date().toISOString();
  let ref = randomRef();
  while (await getBookingByRef(ref)) ref = randomRef();
  const booking: Booking = {
    ref,
    shopId: input.shopId ?? DEMO_SHOP_ID,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    email: input.email,
    vehicle: input.vehicle,
    issue: input.issue,
    preferredDate: input.preferredDate,
    status: "PENDING",
    createdAt: ts,
    updatedAt: ts,
  };
  await db.execute({
    sql: `INSERT INTO bookings
      (ref, shop_id, first_name, last_name, phone, email, vehicle, issue, preferred_date, status, eta_date, created_at, updated_at, driver_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      booking.ref, booking.shopId, booking.firstName, booking.lastName, booking.phone,
      booking.email ?? null, booking.vehicle, booking.issue, booking.preferredDate,
      booking.status, booking.etaDate ?? null, booking.createdAt, booking.updatedAt,
      driverId ?? null,
    ],
  });
  return booking;
}

/**
 * Look up a booking by ref. When `shopId` is supplied the lookup is scoped to
 * that shop (tenant isolation) — a booking from another shop is invisible.
 */
export async function getBookingByRef(
  ref: string,
  shopId?: string,
): Promise<Booking | undefined> {
  await ready();
  const res = shopId
    ? await db.execute({
        sql: `SELECT * FROM bookings WHERE ref = ? AND shop_id = ?`,
        args: [ref.toUpperCase(), shopId],
      })
    : await db.execute({
        sql: `SELECT * FROM bookings WHERE ref = ?`,
        args: [ref.toUpperCase()],
      });
  return res.rows[0] ? rowToBooking(res.rows[0]) : undefined;
}

// `driverId` is not part of the public Booking type, but the messaging thread
// needs it for membership checks (is this driver a party?) and to push the
// driver's device. This shop-unscoped lookup returns the booking PLUS its
// driver id without leaking driver_id into the public Booking shape.
export interface BookingWithDriver {
  booking: Booking;
  driverId?: string;
}

export async function getBookingWithDriverByRef(
  ref: string,
): Promise<BookingWithDriver | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE ref = ?`,
    args: [ref.toUpperCase()],
  });
  const row = res.rows[0];
  if (!row) return undefined;
  return { booking: rowToBooking(row), driverId: maybe(row.driver_id) };
}

// `shopId` is REQUIRED: never list across tenants and never default it from a
// request body. Callers must pass the authenticated session's shopId.
export async function listBookings(shopId: string): Promise<Booking[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE shop_id = ? ORDER BY created_at DESC`,
    args: [shopId],
  });
  // Surface hasDriver (driver_id non-null) so the dashboard knows whether the
  // booking has a customer account it can message. driver_id is not part of the
  // public Booking shape, so derive the boolean here rather than leak the id.
  return res.rows.map((r) => ({
    ...rowToBooking(r),
    hasDriver: r.driver_id != null,
  }));
}

/**
 * Update a booking's status (and optionally its ETA), scoped to `shopId` so a
 * shop can only ever touch its own bookings.
 *
 * etaDate semantics:
 *   - undefined        → leave the existing ETA unchanged
 *   - ""  (empty)      → treated as "no change" (empty-string is not a value)
 *   - null             → explicitly clear the ETA
 *   - non-empty string → set the ETA
 */
export async function updateBookingStatus(
  ref: string,
  shopId: string,
  status: BookingStatus,
  etaDate?: string | null,
): Promise<Booking | undefined> {
  await ready();
  const existing = await getBookingByRef(ref, shopId);
  if (!existing) return undefined;
  const updatedAt = new Date().toISOString();

  let eta: string | null;
  if (etaDate === undefined || etaDate === "") {
    // No change requested — preserve whatever is stored.
    eta = existing.etaDate ?? null;
  } else {
    // Explicit null clears it; a non-empty string sets it.
    eta = etaDate;
  }

  await db.execute({
    sql: `UPDATE bookings SET status = ?, eta_date = ?, updated_at = ? WHERE ref = ? AND shop_id = ?`,
    args: [status, eta, updatedAt, existing.ref, shopId],
  });
  return { ...existing, status, etaDate: eta ?? undefined, updatedAt };
}

/** All bookings created by a given driver, newest first. */
export async function listBookingsByDriver(driverId: string): Promise<Booking[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM bookings WHERE driver_id = ? ORDER BY created_at DESC`,
    args: [driverId],
  });
  return res.rows.map(rowToBooking);
}

// ---- Quotes & invoicing (V3) ----
// A booking carries a quote (line_items in cents) plus a lifecycle:
//   quote_status: 'none'|'draft'|'sent'|'approved'|'declined'|'paid'
//   payment_status: 'unpaid'|'paid'
// All amounts are INTEGER CENTS end to end.

export type QuoteStatus =
  | "none"
  | "draft"
  | "sent"
  | "approved"
  | "declined"
  | "paid";
export type PaymentStatus = "unpaid" | "paid";

export interface QuoteLineItem {
  id: string;
  description: string;
  amountCents: number;
}

export interface Quote {
  status: QuoteStatus;
  totalCents: number;
  paymentStatus: PaymentStatus;
  paidAt?: string;
  items: QuoteLineItem[];
}

const MAX_DESCRIPTION = 200;
const MAX_LINE_ITEMS = 100;

/**
 * Replace the line items for a booking's quote (shop side). Deletes any existing
 * line_items for the ref, inserts the new ones, recomputes the total, and moves
 * the quote to 'draft'. Amounts must be integer cents >= 0; descriptions are
 * required and capped. Scoped to shopId so a shop only touches its own booking.
 * Returns the resulting draft Quote.
 */
export async function setQuoteItems(
  ref: string,
  shopId: string,
  items: Array<{ description: string; amountCents: number }>,
): Promise<Quote> {
  await ready();
  const bookingRef = ref.toUpperCase();

  // Lock editing once the quote has left the draft stage: only 'none' (no quote
  // yet) and 'draft' may be edited. A 'sent'/'approved'/'declined'/'paid' quote
  // is frozen — callers map this to HTTP 409.
  const current = await getQuote(bookingRef);
  if (current.status !== "none" && current.status !== "draft") {
    throw new Error("Quote can no longer be edited (already sent)");
  }

  if (items.length > MAX_LINE_ITEMS) {
    throw new Error(`A quote can have at most ${MAX_LINE_ITEMS} line items`);
  }

  // Validate + normalize every item up front (all-or-nothing).
  const clean = items.map((it) => {
    const description = String(it.description ?? "").trim();
    if (!description) throw new Error("Each line item needs a description");
    if (description.length > MAX_DESCRIPTION) {
      throw new Error(`Description must be at most ${MAX_DESCRIPTION} characters`);
    }
    const amountCents = Number(it.amountCents);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new Error("Amounts must be a whole number of cents (>= 0)");
    }
    return { description, amountCents };
  });

  const totalCents = clean.reduce((sum, it) => sum + it.amountCents, 0);
  const createdAt = new Date().toISOString();

  // Clear then re-insert. (libSQL has no multi-statement tx helper here; the
  // delete+insert+update run sequentially — acceptable for this single-writer
  // shop flow.)
  await db.execute({
    sql: `DELETE FROM line_items WHERE booking_ref = ? AND shop_id = ?`,
    args: [bookingRef, shopId],
  });
  for (const it of clean) {
    await db.execute({
      sql: `INSERT INTO line_items (id, booking_ref, shop_id, description, amount_cents, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [randomId("li"), bookingRef, shopId, it.description, it.amountCents, createdAt],
    });
  }
  await db.execute({
    sql: `UPDATE bookings SET quote_total_cents = ?, quote_status = 'draft', updated_at = ?
      WHERE ref = ? AND shop_id = ?`,
    args: [totalCents, createdAt, bookingRef, shopId],
  });

  return getQuote(bookingRef);
}

/** Mark a booking's quote as sent to the customer (shop side, scoped to shop). */
export async function sendQuote(ref: string, shopId: string): Promise<Quote> {
  await ready();
  const bookingRef = ref.toUpperCase();

  // Only a 'draft' quote with at least one line item can be sent. This guards
  // against re-sending an already-sent/approved quote and sending an empty one.
  // Callers map these errors to HTTP 409 / 400.
  const current = await getQuote(bookingRef);
  if (current.status !== "draft") {
    throw new Error("Quote can only be sent from draft");
  }
  if (current.items.length === 0) {
    throw new Error("Add at least one line item first");
  }

  await db.execute({
    sql: `UPDATE bookings SET quote_status = 'sent', updated_at = ?
      WHERE ref = ? AND shop_id = ?`,
    args: [new Date().toISOString(), bookingRef, shopId],
  });
  return getQuote(bookingRef);
}

/** Driver approves a sent quote. Scoped to the booking's driver. */
export async function approveQuote(ref: string, driverId: string): Promise<Quote> {
  await ready();
  const bookingRef = ref.toUpperCase();
  await db.execute({
    sql: `UPDATE bookings SET quote_status = 'approved', updated_at = ?
      WHERE ref = ? AND driver_id = ?`,
    args: [new Date().toISOString(), bookingRef, driverId],
  });
  return getQuote(bookingRef);
}

/** Driver declines a sent quote. Scoped to the booking's driver. */
export async function declineQuote(ref: string, driverId: string): Promise<Quote> {
  await ready();
  const bookingRef = ref.toUpperCase();
  await db.execute({
    sql: `UPDATE bookings SET quote_status = 'declined', updated_at = ?
      WHERE ref = ? AND driver_id = ?`,
    args: [new Date().toISOString(), bookingRef, driverId],
  });
  return getQuote(bookingRef);
}

/**
 * Mark a booking paid: payment_status='paid', paid_at=now, quote_status='paid'.
 * Used by the SIM confirm route and the Stripe webhook. Unscoped (the webhook
 * has no session); callers must have established trust (signed webhook or an
 * already-authorized driver).
 *
 * CONDITIONAL: the UPDATE only fires WHERE payment_status='unpaid', so a replay
 * or already-paid booking is a no-op. Returns true ONLY on the real unpaid->paid
 * transition (rowsAffected>0) so callers notify exactly once.
 */
export async function markPaid(ref: string): Promise<boolean> {
  await ready();
  const bookingRef = ref.toUpperCase();
  const now = new Date().toISOString();
  const res = await db.execute({
    sql: `UPDATE bookings SET payment_status = 'paid', paid_at = ?, quote_status = 'paid', updated_at = ?
      WHERE ref = ? AND payment_status = 'unpaid'`,
    args: [now, now, bookingRef],
  });
  return res.rowsAffected > 0;
}

/**
 * Record that a Stripe event id has been processed. Returns true if this is the
 * FIRST time we've seen it (newly inserted), false if it was already recorded —
 * the basis for webhook dedup. INSERT OR IGNORE makes it safe under concurrency.
 */
export async function markEventProcessed(eventId: string): Promise<boolean> {
  await ready();
  const res = await db.execute({
    sql: `INSERT OR IGNORE INTO processed_events (id, created_at) VALUES (?, ?)`,
    args: [eventId, new Date().toISOString()],
  });
  return res.rowsAffected > 0;
}

/**
 * Read-only check used by the webhook fast-path. The webhook records the event
 * id only AFTER the payment is recorded, so this never reports "processed" for an
 * event whose markPaid hasn't actually committed.
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  await ready();
  const res = await db.execute({
    sql: `SELECT 1 FROM processed_events WHERE id = ? LIMIT 1`,
    args: [eventId],
  });
  return res.rows.length > 0;
}

/** Record the Stripe Checkout Session id created for a booking (unscoped). */
export async function setBookingSessionId(ref: string, sessionId: string): Promise<void> {
  await ready();
  await db.execute({
    sql: `UPDATE bookings SET stripe_session_id = ? WHERE ref = ?`,
    args: [sessionId, ref.toUpperCase()],
  });
}

/** Read a booking's full quote: status, total, payment, and line items. */
export async function getQuote(ref: string): Promise<Quote> {
  await ready();
  const bookingRef = ref.toUpperCase();
  const bookingRes = await db.execute({
    sql: `SELECT quote_status, quote_total_cents, payment_status, paid_at FROM bookings WHERE ref = ?`,
    args: [bookingRef],
  });
  const b = bookingRes.rows[0];
  const itemsRes = await db.execute({
    sql: `SELECT id, description, amount_cents FROM line_items WHERE booking_ref = ? ORDER BY created_at ASC, id ASC`,
    args: [bookingRef],
  });
  const items: QuoteLineItem[] = itemsRes.rows.map((r) => ({
    id: str(r.id),
    description: str(r.description),
    amountCents: Number(r.amount_cents),
  }));
  return {
    status: (b ? (maybe(b.quote_status) ?? "none") : "none") as QuoteStatus,
    totalCents: b && b.quote_total_cents != null ? Number(b.quote_total_cents) : 0,
    paymentStatus: (b ? (maybe(b.payment_status) ?? "unpaid") : "unpaid") as PaymentStatus,
    paidAt: b ? maybe(b.paid_at) : undefined,
    items,
  };
}

// ---- Users / shops ----
export async function getUserByEmail(email: string): Promise<User | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM users WHERE email = ?`,
    args: [email.trim().toLowerCase()],
  });
  return res.rows[0] ? rowToUser(res.rows[0]) : undefined;
}

export async function getShop(id: string): Promise<Shop | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT id, name FROM shops WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  return row ? { id: str(row.id), name: str(row.name) } : undefined;
}

// ---- Push subscriptions ----
export async function addPushSubscription(
  rec: Omit<PushRecord, "id" | "createdAt">,
): Promise<PushRecord> {
  await ready();
  const existing = await db.execute({
    sql: `SELECT * FROM push_subs WHERE endpoint = ? AND role = ? AND IFNULL(booking_ref,'') = IFNULL(?,'')`,
    args: [rec.subscription.endpoint, rec.role, rec.bookingRef ?? null],
  });
  if (existing.rows[0]) {
    // Same (endpoint, role, bookingRef) already registered: REFRESH the keys
    // instead of returning the stale row. Push keys can rotate when the browser
    // re-subscribes against the same endpoint; a stale p256dh/auth would make
    // every send fail with an encryption error.
    const prev = existing.rows[0];
    await db.execute({
      sql: `UPDATE push_subs SET p256dh = ?, auth = ?, shop_id = ?, driver_id = ? WHERE id = ?`,
      args: [
        rec.subscription.keys.p256dh,
        rec.subscription.keys.auth,
        rec.shopId,
        rec.driverId ?? null,
        str(prev.id),
      ],
    });
    return {
      ...rec,
      id: str(prev.id),
      createdAt: str(prev.created_at),
    };
  }

  const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO push_subs (id, role, booking_ref, driver_id, shop_id, endpoint, p256dh, auth, created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
    args: [
      id, rec.role, rec.bookingRef ?? null, rec.driverId ?? null, rec.shopId,
      rec.subscription.endpoint, rec.subscription.keys.p256dh, rec.subscription.keys.auth, createdAt,
    ],
  });
  return { ...rec, id, createdAt };
}

export async function getCustomerSubscriptions(bookingRef: string): Promise<PushRecord[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM push_subs WHERE role = 'customer' AND booking_ref = ?`,
    args: [bookingRef.toUpperCase()],
  });
  return res.rows.map(rowToPush);
}

export async function getStaffSubscriptions(shopId = DEMO_SHOP_ID): Promise<PushRecord[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM push_subs WHERE role = 'staff' AND shop_id = ?`,
    args: [shopId],
  });
  return res.rows.map(rowToPush);
}

/** A driver's own device subscriptions (role='driver'), used to push them in-app messages and status changes. */
export async function getDriverSubscriptions(driverId: string): Promise<PushRecord[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM push_subs WHERE role = 'driver' AND driver_id = ?`,
    args: [driverId],
  });
  return res.rows.map(rowToPush);
}

export async function removeSubscriptionByEndpoint(endpoint: string): Promise<void> {
  await ready();
  await db.execute({ sql: `DELETE FROM push_subs WHERE endpoint = ?`, args: [endpoint] });
}

// ---- Messages (threaded per booking) ----

/** Append a message to a booking's thread. driverId is optional (null for public-customer bookings). */
export async function addMessage(input: {
  bookingRef: string;
  shopId: string;
  driverId?: string | null;
  sender: Message["sender"];
  body: string;
}): Promise<Message> {
  await ready();
  const id = randomId("msg");
  const createdAt = new Date().toISOString();
  const bookingRef = input.bookingRef.toUpperCase();
  await db.execute({
    sql: `INSERT INTO messages (id, booking_ref, shop_id, driver_id, sender, body, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, bookingRef, input.shopId, input.driverId ?? null, input.sender, input.body, createdAt],
  });
  return {
    id,
    bookingRef,
    shopId: input.shopId,
    driverId: input.driverId ?? undefined,
    sender: input.sender,
    body: input.body,
    createdAt,
  };
}

/** All messages for a booking, oldest-first (chat order). */
export async function listMessages(bookingRef: string): Promise<Message[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM messages WHERE booking_ref = ? ORDER BY created_at ASC`,
    args: [bookingRef.toUpperCase()],
  });
  return res.rows.map(rowToMessage);
}

// ---- Magic sign-in tokens (driver auth) ----

export interface MagicToken {
  id: string;
  email: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

/**
 * Create a single-use magic token. The caller supplies the (unguessable) id so
 * it can embed the SAME value in the sign-in link. `expiresAt` is an ISO string.
 */
export async function createMagicToken(input: {
  id: string;
  email: string;
  expiresAt: string;
}): Promise<MagicToken> {
  await ready();
  const createdAt = new Date().toISOString();
  const email = input.email.trim().toLowerCase();
  // Opportunistic GC: drop spent (used) and expired tokens so the table stays
  // bounded. Best-effort — a failure here must not block minting a fresh token.
  try {
    await db.execute({
      sql: `DELETE FROM magic_tokens WHERE used = 1 OR expires_at < ?`,
      args: [createdAt],
    });
  } catch {
    /* non-fatal cleanup */
  }
  await db.execute({
    sql: `INSERT INTO magic_tokens (id, email, expires_at, used, created_at)
      VALUES (?, ?, ?, 0, ?)`,
    args: [input.id, email, input.expiresAt, createdAt],
  });
  return { id: input.id, email, expiresAt: input.expiresAt, used: false, createdAt };
}

/**
 * Atomically consume a token: returns the (lowercased) email if the token
 * exists, is unused, and is not expired; otherwise undefined. The UPDATE ...
 * WHERE used = 0 makes consumption single-use even under concurrent verify
 * requests (only one UPDATE flips used 0 -> 1).
 */
export async function consumeMagicToken(id: string): Promise<string | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT email, expires_at, used FROM magic_tokens WHERE id = ?`,
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return undefined;
  if (Number(row.used) !== 0) return undefined;
  if (new Date(str(row.expires_at)).getTime() <= Date.now()) return undefined;

  const upd = await db.execute({
    sql: `UPDATE magic_tokens SET used = 1 WHERE id = ? AND used = 0`,
    args: [id],
  });
  // rowsAffected === 0 means another request consumed it first — treat as invalid.
  if (upd.rowsAffected === 0) return undefined;
  return str(row.email);
}

/**
 * Count magic-link tokens minted for `email` since `sinceIso`. Used to rate-limit
 * the request endpoint so one inbox can't be bombed (and Resend can't be cost-
 * amplified). Email is matched in the same lowercased form it is stored.
 */
export async function countRecentMagicTokens(email: string, sinceIso: string): Promise<number> {
  await ready();
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM magic_tokens WHERE email = ? AND created_at >= ?`,
    args: [email.trim().toLowerCase(), sinceIso],
  });
  return Number(res.rows[0].n);
}

// ---- Drivers ----

export async function getDriverByEmail(email: string): Promise<Driver | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM drivers WHERE email = ?`,
    args: [email.trim().toLowerCase()],
  });
  return res.rows[0] ? rowToDriver(res.rows[0]) : undefined;
}

export async function getDriverById(id: string): Promise<Driver | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM drivers WHERE id = ?`,
    args: [id],
  });
  return res.rows[0] ? rowToDriver(res.rows[0]) : undefined;
}

export async function createDriver(email: string): Promise<Driver> {
  await ready();
  const id = randomId("drv");
  const createdAt = new Date().toISOString();
  const normalized = email.trim().toLowerCase();
  await db.execute({
    sql: `INSERT INTO drivers (id, email, name, phone, created_at) VALUES (?, ?, NULL, NULL, ?)`,
    args: [id, normalized, createdAt],
  });
  return { id, email: normalized, createdAt };
}

/** Find a driver by email, creating one if absent. Email is the unique key. */
export async function findOrCreateDriver(email: string): Promise<Driver> {
  const existing = await getDriverByEmail(email);
  if (existing) return existing;
  try {
    return await createDriver(email);
  } catch (e) {
    // Only a UNIQUE/constraint violation means we lost a race against a
    // concurrent create — re-read in that case. Any other error (DB down, etc.)
    // is a real failure and must propagate.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/unique|constraint/i.test(msg)) throw e;
    const after = await getDriverByEmail(email);
    if (after) return after;
    throw new Error("failed to create driver");
  }
}

/** Persist a phone number onto a driver (used when a driver books with a phone). */
export async function updateDriverPhone(driverId: string, phone: string): Promise<void> {
  await ready();
  await db.execute({
    sql: `UPDATE drivers SET phone = ? WHERE id = ?`,
    args: [phone, driverId],
  });
}

// ---- Cars (all scoped by driver_id) ----

export async function addCar(input: {
  driverId: string;
  year?: number;
  make?: string;
  model?: string;
  plate?: string;
}): Promise<Car> {
  await ready();
  const id = randomId("car");
  const createdAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO cars (id, driver_id, year, make, model, plate, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      input.driverId,
      input.year ?? null,
      input.make ?? null,
      input.model ?? null,
      input.plate ?? null,
      createdAt,
    ],
  });
  return {
    id,
    driverId: input.driverId,
    year: input.year,
    make: input.make,
    model: input.model,
    plate: input.plate,
    createdAt,
  };
}

export async function listCars(driverId: string): Promise<Car[]> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM cars WHERE driver_id = ? ORDER BY created_at DESC`,
    args: [driverId],
  });
  return res.rows.map(rowToCar);
}

/** Fetch a single car, scoped to its owner so one driver can't read another's. */
export async function getCar(id: string, driverId: string): Promise<Car | undefined> {
  await ready();
  const res = await db.execute({
    sql: `SELECT * FROM cars WHERE id = ? AND driver_id = ?`,
    args: [id, driverId],
  });
  return res.rows[0] ? rowToCar(res.rows[0]) : undefined;
}

/** Delete a car scoped to its owner. Returns true only if a row was removed. */
export async function deleteCar(id: string, driverId: string): Promise<boolean> {
  await ready();
  const res = await db.execute({
    sql: `DELETE FROM cars WHERE id = ? AND driver_id = ?`,
    args: [id, driverId],
  });
  return res.rowsAffected > 0;
}
