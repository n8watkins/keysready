// Turso / libSQL database client.
//
// libSQL is a SQLite fork — RELATIONAL, but serverless/edge-friendly and NOT Google.
// Local dev:  uses a SQLite file (file:.data/app.db) — no account needed.
// Production: set DATABASE_URL=libsql://<db>.turso.io and DATABASE_AUTH_TOKEN=<token>.
// The exact same @libsql/client code talks to both.

import { createClient, type Client, type Row } from "@libsql/client";
import { mkdirSync } from "fs";
import { dirname } from "path";
import { hashPassword, verifyPassword } from "./auth";

const url = process.env.DATABASE_URL || "file:.data/app.db";

// Ensure the parent dir exists for a local file DB (skipped for remote libsql:// URLs).
if (url.startsWith("file:")) {
  const path = url.slice("file:".length);
  try {
    mkdirSync(dirname(path) || ".", { recursive: true });
  } catch {
    /* ignore */
  }
}

export const db: Client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN, // undefined for local file DBs
});

let migrated: Promise<void> | null = null;

/**
 * Runs once per process: creates tables and seeds demo data if empty.
 * Self-healing: if migration rejects (e.g. a transient cold-start error), the
 * cached promise is cleared so the next caller retries instead of getting stuck
 * on a permanently-rejected promise.
 */
export function ready(): Promise<void> {
  if (!migrated) {
    migrated = migrate().catch((e) => {
      migrated = null;
      throw e;
    });
  }
  return migrated;
}

async function migrate(): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS shops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS bookings (
    ref TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    vehicle TEXT NOT NULL,
    issue TEXT NOT NULL,
    preferred_date TEXT NOT NULL,
    status TEXT NOT NULL,
    eta_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS push_subs (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    booking_ref TEXT,
    shop_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  // In-app messages, threaded per booking. driver_id is nullable (a public
  // customer booking has no driver); sender is 'shop' | 'driver'.
  await db.execute(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    booking_ref TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    driver_id TEXT,
    sender TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);

  // ---- Driver-side tables (car owners). Separate auth from staff. ----
  await db.execute(`CREATE TABLE IF NOT EXISTS drivers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    created_at TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS cars (
    id TEXT PRIMARY KEY,
    driver_id TEXT NOT NULL,
    year INTEGER,
    make TEXT,
    model TEXT,
    plate TEXT,
    created_at TEXT
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS magic_tokens (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT
  )`);

  // Link bookings to a driver. SQLite's ALTER TABLE ADD COLUMN throws if the
  // column already exists, so guard it via pragma table_info so re-running
  // migrate() (cold starts, restarts) stays idempotent.
  await addBookingDriverIdColumn();

  // push_subs predates driver-device subscriptions; add its driver_id column
  // (nullable) the same idempotent way so role='driver' rows can record which
  // driver's device a subscription belongs to.
  await addPushSubsDriverIdColumn();

  // V3 invoicing & payments: a booking carries a quote (its line_items live in a
  // separate table) plus the quote/payment lifecycle columns. Added idempotently
  // (guarded ALTER) like driver_id so cold starts/restarts stay safe.
  await addBookingQuoteColumns();

  // V3: line items for a booking's quote/invoice. All amounts are INTEGER CENTS.
  await db.execute(`CREATE TABLE IF NOT EXISTS line_items (
    id TEXT PRIMARY KEY,
    booking_ref TEXT NOT NULL,
    shop_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    created_at TEXT
  )`);

  // Stripe webhook idempotency: every successfully-processed Stripe event id is
  // recorded here so a redelivered/replayed event is a no-op (INSERT OR IGNORE).
  await db.execute(`CREATE TABLE IF NOT EXISTS processed_events (
    id TEXT PRIMARY KEY,
    created_at TEXT
  )`);

  // Stripe checkout idempotency: record the Checkout Session id we created for a
  // booking so the webhook/UI can correlate it. Nullable, added idempotently
  // (guarded ALTER) like the quote columns so cold starts/restarts stay safe.
  await addBookingSessionIdColumn();

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bookings_shop ON bookings(shop_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_subs_lookup ON push_subs(role, booking_ref, shop_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_subs_driver ON push_subs(role, driver_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_cars_driver ON cars(driver_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_ref)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_line_items_booking ON line_items(booking_ref)`);
  await seed();
}

/**
 * Add the V3 quote/payment columns to bookings if absent. Idempotent like
 * addBookingDriverIdColumn: checks pragma table_info per column and swallows a
 * concurrent "duplicate column" error so cold starts/restarts can re-run safely.
 *   quote_status      'none'|'draft'|'sent'|'approved'|'declined'|'paid' (default 'none')
 *   quote_total_cents INTEGER cents (nullable until a quote is built)
 *   payment_status    'unpaid'|'paid' (default 'unpaid')
 *   paid_at           ISO timestamp the booking was paid (nullable)
 */
async function addBookingQuoteColumns(): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(bookings)`);
  const have = new Set(info.rows.map((r) => String(r.name)));
  const cols: Array<[string, string]> = [
    ["quote_status", `ALTER TABLE bookings ADD COLUMN quote_status TEXT DEFAULT 'none'`],
    ["quote_total_cents", `ALTER TABLE bookings ADD COLUMN quote_total_cents INTEGER`],
    ["payment_status", `ALTER TABLE bookings ADD COLUMN payment_status TEXT DEFAULT 'unpaid'`],
    ["paid_at", `ALTER TABLE bookings ADD COLUMN paid_at TEXT`],
  ];
  for (const [name, sql] of cols) {
    if (have.has(name)) continue;
    try {
      await db.execute(sql);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/duplicate column/i.test(msg)) throw e;
    }
  }
}

/**
 * Add bookings.stripe_session_id (nullable) if it isn't already present.
 * Idempotent like addBookingDriverIdColumn: checks pragma table_info first and
 * swallows a concurrent "duplicate column" error. Records which Stripe Checkout
 * Session was created for a booking so the payment flow can correlate it.
 */
async function addBookingSessionIdColumn(): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(bookings)`);
  const hasColumn = info.rows.some((r) => String(r.name) === "stripe_session_id");
  if (hasColumn) return;
  try {
    await db.execute(`ALTER TABLE bookings ADD COLUMN stripe_session_id TEXT`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
}

/**
 * Add bookings.driver_id (nullable) if it isn't already present. Idempotent:
 * checks pragma table_info first, and also swallows a "duplicate column" error
 * in case a concurrent cold-start adds it between the check and the ALTER.
 */
async function addBookingDriverIdColumn(): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(bookings)`);
  const hasColumn = info.rows.some((r) => String(r.name) === "driver_id");
  if (hasColumn) return;
  try {
    await db.execute(`ALTER TABLE bookings ADD COLUMN driver_id TEXT`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
}

/**
 * Add push_subs.driver_id (nullable) if it isn't already present. Idempotent,
 * exactly like addBookingDriverIdColumn: checks pragma table_info first and
 * swallows a concurrent "duplicate column" error. role='driver' rows store the
 * driver id here so a driver's single device can receive their pushes.
 */
async function addPushSubsDriverIdColumn(): Promise<void> {
  const info = await db.execute(`PRAGMA table_info(push_subs)`);
  const hasColumn = info.rows.some((r) => String(r.name) === "driver_id");
  if (hasColumn) return;
  try {
    await db.execute(`ALTER TABLE push_subs ADD COLUMN driver_id TEXT`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/duplicate column/i.test(msg)) throw e;
  }
}

async function seed(): Promise<void> {
  // All seeds use INSERT OR IGNORE so concurrent cold-starts can't throw on a
  // PRIMARY KEY / UNIQUE conflict — the first writer wins, the rest are no-ops.
  await db.execute({
    sql: `INSERT OR IGNORE INTO shops (id, name) VALUES (?, ?)`,
    args: ["demo-shop", "QuickFix Auto"],
  });

  const nowMinus = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const demo = [
    ["BK-7F3A2K", "demo-shop", "Maria", "Lopez", "+15125550147", "maria@example.com",
      "2018 Honda Civic", "Brake pads squealing and AC not cold", nowMinus(-1), "IN_PROGRESS",
      nowMinus(-1), nowMinus(1), nowMinus(0)],
    ["BK-9Q2M4P", "demo-shop", "Dev", "Patel", "+15125550162", null,
      "2020 Toyota Tacoma", "Check engine light + 60k mile service", nowMinus(-2), "PENDING",
      null, nowMinus(0), nowMinus(0)],
  ];
  for (const b of demo) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO bookings
        (ref, shop_id, first_name, last_name, phone, email, vehicle, issue, preferred_date, status, eta_date, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: b,
    });
  }

  await seedDemoStaff();
}

/** Row id of the seeded demo OWNER account. */
const DEMO_STAFF_ID = "user_demo_staff";

/**
 * Passwords that were ever shipped as defaults or published in docs/scripts.
 * They are never accepted for the demo owner, and an existing row that still
 * verifies against one is disabled on boot (older builds seeded them).
 */
const KNOWN_DEFAULT_DEMO_PASSWORDS = ["keysready-demo"];
const MIN_DEMO_PASSWORD_LENGTH = 12;

/** Why a configured demo password is unusable, or null when it is acceptable. */
export function demoPasswordProblem(password: string | undefined): string | null {
  if (!password) return "DEMO_STAFF_PASSWORD is unset";
  if (KNOWN_DEFAULT_DEMO_PASSWORDS.includes(password)) {
    return "DEMO_STAFF_PASSWORD is a published default";
  }
  if (password.length < MIN_DEMO_PASSWORD_LENGTH) {
    return `DEMO_STAFF_PASSWORD is shorter than ${MIN_DEMO_PASSWORD_LENGTH} characters`;
  }
  return null;
}

/**
 * Seed (or re-key) the demo OWNER account, and make sure no known default
 * credential survives in the database.
 *
 * - Seeding happens ONLY when SEED_DEMO_STAFF=true AND DEMO_STAFF_PASSWORD is a
 *   strong, non-default value. Set it only on the public demo deployment.
 * - When seeding, an existing row is re-keyed to the configured password, so
 *   rotating the env var rotates the login (INSERT OR IGNORE alone would keep
 *   whatever password an older build seeded).
 * - When not seeding, an existing demo row whose hash still matches a published
 *   default is disabled (its hash is replaced with a value nothing verifies).
 */
async function seedDemoStaff(): Promise<void> {
  const enabled = process.env.SEED_DEMO_STAFF === "true";
  const password = process.env.DEMO_STAFF_PASSWORD;
  const problem = enabled ? demoPasswordProblem(password) : null;
  if (enabled && problem) {
    console.warn(`[seed] SEED_DEMO_STAFF=true but ${problem}; skipping demo staff seed`);
  }

  const existing = await db.execute({
    sql: "SELECT email, password_hash FROM users WHERE id = ?",
    args: [DEMO_STAFF_ID],
  });
  const row = existing.rows[0];
  const storedHash = row ? String(row.password_hash) : null;

  if (!enabled || problem) {
    if (storedHash && KNOWN_DEFAULT_DEMO_PASSWORDS.some((p) => verifyPassword(p, storedHash))) {
      await db.execute({
        sql: "UPDATE users SET password_hash = ? WHERE id = ?",
        args: ["disabled:known-default-password", DEMO_STAFF_ID],
      });
      console.warn("[seed] disabled the demo staff login, which still used a published default password");
    }
    return;
  }

  // Normalize the email (the login lookup lowercases too) so the UNIQUE key and
  // the lookup always agree regardless of how the env var is cased.
  const email = (process.env.DEMO_STAFF_EMAIL || "demo@keysready.app").trim().toLowerCase();
  if (!row) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, shop_id, email, password_hash, role, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      args: [DEMO_STAFF_ID, "demo-shop", email, hashPassword(password!), "owner", new Date().toISOString()],
    });
    return;
  }
  if (String(row.email) !== email || !storedHash || !verifyPassword(password!, storedHash)) {
    await db.execute({
      sql: "UPDATE users SET email = ?, password_hash = ? WHERE id = ?",
      args: [email, hashPassword(password!), DEMO_STAFF_ID],
    });
  }
}

export type { Row };
