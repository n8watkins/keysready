// Durable daily caps on the public endpoints that cost something: driver
// sign-in links (an email each) and bookings (a row and a staff push each).
//
// Counters live in D1 (the Worker's LIMITS binding) as one row per bucket and
// UTC day, so they hold across isolates and deploys. Outside the Worker
// (next dev, next start in the e2e scripts) they use the app's own database.
// On the Worker a missing binding or a failed query refuses the request: the
// caps fail closed.
//
// Per-IP buckets store an HMAC of the address (IPv6 cut to its /64, which one
// machine can rotate through), never the address itself.

import { createHmac } from "crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** The caps, per UTC day. The mailroom also caps sign-in mail (60 a day). */
export const CAPS = {
  "driver-signin": { perIp: 10, site: 60 },
  booking: { perIp: 5, site: 100 },
} as const;

export type CapKind = keyof typeof CAPS;

/** The few SQL calls the caps need, over D1 or libSQL. */
export interface SqlStore {
  all(sql: string, args: (string | number)[]): Promise<Record<string, unknown>[]>;
}

/** Minimal D1 surface, so tests don't need the Workers types at runtime. */
interface D1Like {
  prepare(sql: string): {
    bind(...args: (string | number)[]): { all(): Promise<{ results: Record<string, unknown>[] }> };
  };
}

export function d1Store(db: D1Like): SqlStore {
  return {
    all: async (sql, args) => (await db.prepare(sql).bind(...args).all()).results,
  };
}

export function libsqlStore(db: {
  execute(q: { sql: string; args: (string | number)[] }): Promise<{ rows: unknown[] }>;
}): SqlStore {
  return {
    all: async (sql, args) => (await db.execute({ sql, args })).rows as Record<string, unknown>[],
  };
}

const SCHEMA = `CREATE TABLE IF NOT EXISTS rate_counts (
  bucket TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (bucket, day)
)`;

// Per-isolate memo of "the table exists": only skips a repeated CREATE.
const ready = new WeakSet<SqlStore>();

async function bump(store: SqlStore, bucket: string, day: string): Promise<number> {
  const rows = await store.all(
    `INSERT INTO rate_counts (bucket, day, n) VALUES (?, ?, 1)
     ON CONFLICT (bucket, day) DO UPDATE SET n = n + 1
     RETURNING n`,
    [bucket, day],
  );
  const n = Number(rows[0]?.n);
  if (!Number.isFinite(n)) throw new Error("rate_counts upsert returned no count");
  return n;
}

/** The /64 of an IPv6 address, or the IPv4 address as is. */
export function ipKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head] = ip.split("%");
  const parts = head.split("::");
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length > 1 && parts[1] ? parts[1].split(":") : [];
  const groups = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right];
  return groups.slice(0, 4).map((g) => g.toLowerCase().replace(/^0+(?=.)/, "")).join(":") + "::/64";
}

function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ipKey(ip)).digest("hex").slice(0, 32);
}

export type CapResult = { ok: true } | { ok: false; reason: "ip" | "site" | "unavailable" };

/**
 * Spend one unit of today's per-IP cap, then of the site-wide cap. A request
 * the per-IP cap refuses doesn't touch the site-wide count, so one address
 * can't use up everyone's day. Never throws.
 */
export async function consumeCap(
  store: SqlStore | null,
  kind: CapKind,
  ip: string | null,
  opts: { now?: Date; secret?: string; caps?: { perIp: number; site: number } } = {},
): Promise<CapResult> {
  if (!store) return { ok: false, reason: "unavailable" };
  const caps = opts.caps ?? CAPS[kind];
  const secret = opts.secret ?? process.env.SESSION_SECRET ?? "";
  const day = (opts.now ?? new Date()).toISOString().slice(0, 10);
  try {
    if (!ready.has(store)) {
      await store.all(SCHEMA, []);
      ready.add(store);
    }
    const ipBucket = `${kind}:ip:${ip ? hashIp(ip, secret) : "unknown"}`;
    const perIp = await bump(store, ipBucket, day);
    if (perIp === 1) {
      // First request of the day for this bucket: drop rows older than yesterday.
      await store.all(`DELETE FROM rate_counts WHERE day < ?`, [
        new Date(Date.parse(day) - 86_400_000).toISOString().slice(0, 10),
      ]);
    }
    if (perIp > caps.perIp) return { ok: false, reason: "ip" };
    if ((await bump(store, `${kind}:site`, day)) > caps.site) return { ok: false, reason: "site" };
    return { ok: true };
  } catch (err) {
    console.error("[limits] cap check failed:", err instanceof Error ? err.message : err);
    return { ok: false, reason: "unavailable" };
  }
}

let localStore: SqlStore | undefined;
const d1Stores = new WeakMap<D1Like, SqlStore>();

/**
 * The store for this runtime: D1 on the Worker (null when the binding is
 * missing, which refuses), the app database everywhere else.
 */
export async function capStore(): Promise<SqlStore | null> {
  let onWorker = false;
  let binding: D1Like | undefined;
  try {
    const env = getCloudflareContext().env as { LIMITS?: D1Like };
    onWorker = true;
    binding = env.LIMITS;
  } catch {
    // Not on the Worker (next dev, next start, tests).
  }
  if (onWorker) {
    if (!binding) return null;
    let store = d1Stores.get(binding);
    if (!store) d1Stores.set(binding, (store = d1Store(binding)));
    return store;
  }
  if (!localStore) {
    const { db, ready: dbReady } = await import("./db");
    await dbReady();
    localStore = libsqlStore(db);
  }
  return localStore;
}
