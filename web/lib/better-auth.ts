// Better Auth — the forward-looking auth foundation (email+password + Google
// OAuth), set up ADDITIVELY alongside the existing hand-rolled staff login
// (/api/auth/login) and driver magic-link (/api/auth/driver/*). It is mounted at
// /api/account/* so nothing collides; the eventual cutover (migrating staff auth
// onto this, adding orgs/RBAC) is a deliberate follow-up.

import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { LibsqlDialect } from "@libsql/kysely-libsql";

// Reuse the exact same Turso/libSQL connection as the rest of the app (db.ts):
// local dev falls back to a SQLite file; prod uses Turso cloud.
const dialect = new LibsqlDialect({
  url: process.env.DATABASE_URL || "file:.data/app.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
export const isGoogleAuthEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  appName: "KeysReady",
  // Own /api/account/* — do NOT shadow the existing /api/auth/* routes.
  basePath: "/api/account",
  baseURL:
    process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:2323",
  // Better Auth needs a signing secret. Reuse SESSION_SECRET when a dedicated
  // BETTER_AUTH_SECRET isn't set — SESSION_SECRET is always present (the app
  // fail-closes without it), so this never boots unsigned.
  secret: process.env.BETTER_AUTH_SECRET || process.env.SESSION_SECRET,
  database: { dialect, type: "sqlite" },
  emailAndPassword: { enabled: true },
  socialProviders: isGoogleAuthEnabled
    ? { google: { clientId: googleClientId!, clientSecret: googleClientSecret! } }
    : undefined,
  // nextCookies() must be LAST — lets Better Auth set cookies from server actions.
  plugins: [nextCookies()],
});
