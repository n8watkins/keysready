// Better Auth — the forward-looking auth foundation (email+password + Google
// OAuth), set up ADDITIVELY alongside the existing hand-rolled staff login
// (/api/auth/login) and driver magic-link (/api/auth/driver/*). It is mounted at
// /api/account/* so nothing collides; the eventual cutover (migrating staff auth
// onto this, adding orgs/RBAC) is a deliberate follow-up.

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getMigrations } from "better-auth/db/migration";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import { ready } from "./db";
import { databaseConfig } from "./db-config";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
export const isGoogleAuthEnabled = Boolean(googleClientId && googleClientSecret);

const options = {
  appName: "KeysReady",
  // Own /api/account/* — do NOT shadow the existing /api/auth/* routes.
  basePath: "/api/account",
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:2323",
  // `next dev` runs on 2323 plus one port per extra worktree (2324, 2325, ...);
  // trust any local port in development so sign-up works on all of them.
  trustedOrigins:
    process.env.NODE_ENV === "development"
      ? ["http://localhost:*", "http://127.0.0.1:*"]
      : undefined,
  // Better Auth needs a signing secret. Reuse SESSION_SECRET when a dedicated
  // BETTER_AUTH_SECRET isn't set — SESSION_SECRET is always present (the app
  // fail-closes without it), so this never boots unsigned.
  secret: process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET,
  // Same Turso/libSQL database as the rest of the app (db.ts): local dev uses a
  // SQLite file; prod uses Turso cloud. (A separate connection, because
  // kysely-libsql pins its own @libsql/client version.)
  database: { dialect: new LibsqlDialect(databaseConfig()), type: "sqlite" },
  emailAndPassword: { enabled: true },
  socialProviders: isGoogleAuthEnabled
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
    : undefined,
  // nextCookies() must be LAST — lets Better Auth set cookies from server actions.
  plugins: [nextCookies()],
} satisfies BetterAuthOptions;

const createAuth = () => betterAuth(options);
export type Auth = ReturnType<typeof createAuth>;

let authInstance: Promise<Auth> | null = null;

/**
 * The Better Auth instance, built once per process after its database schema
 * is in place. Always go through this instead of calling betterAuth() at
 * import time: Better Auth checks the schema as soon as it is constructed, and
 * on a fresh database its tables don't exist yet.
 *
 * Self-healing like ready(): a failure clears the cached promise so the next
 * request retries.
 */
export function getAuth(): Promise<Auth> {
  if (!authInstance) {
    authInstance = ready()
      .then(migrateAuthSchema)
      .then(createAuth)
      .catch((e) => {
        authInstance = null;
        throw e;
      });
  }
  return authInstance;
}

/**
 * Creates Better Auth's tables (user, session, account, verification) and any
 * columns or indexes a newer Better Auth version needs. Better Auth's planner
 * only ever creates missing tables, adds missing columns and adds missing
 * indexes; it never drops or rewrites anything, and it refuses to add a
 * required column to a populated table. On a database that is already up to
 * date it only reads the schema.
 *
 * Runs only for /api/account/*, after ready(), so a Better Auth schema problem
 * can never affect bookings, the dashboard or payments.
 */
async function migrateAuthSchema(): Promise<void> {
  // Two cold starts can plan the same CREATE TABLE at once; the loser fails
  // with "already exists". Re-planning sees the winner's tables and finishes
  // whatever is still missing.
  for (let attempt = 1; ; attempt++) {
    const { toBeCreated, toBeAdded, toBeAddedIndexes, runMigrations } =
      await getMigrations(options);
    if (!toBeCreated.length && !toBeAdded.length && !toBeAddedIndexes.length) return;
    try {
      await runMigrations();
      console.info(
        `[auth] database schema updated: ${[
          ...toBeCreated.map((t) => `created ${t.table}`),
          ...toBeAdded.map((t) => `added ${Object.keys(t.fields).join(", ")} to ${t.table}`),
          ...toBeAddedIndexes.map((i) => `indexed ${i.table} (${i.name})`),
        ].join("; ")}`,
      );
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt >= 3 || !/already exists|duplicate column/i.test(msg)) throw e;
    }
  }
}
