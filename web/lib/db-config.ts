// Where the app's libSQL database lives. Shared by db.ts and better-auth.ts so
// both always talk to the same database.
//
// Local default: a SQLite file at .data/app.db (no account needed).
// Production:    DATABASE_URL=libsql://<db>.turso.io plus DATABASE_AUTH_TOKEN.
//
// `next dev` never writes to a remote database by accident: a remote
// DATABASE_URL (for example a production Turso URL left in .env.local) is
// ignored in development unless ALLOW_REMOTE_DATABASE=true is set as well.

export const LOCAL_DATABASE_URL = "file:.data/app.db";

export type DatabaseConfig = { url: string; authToken: string | undefined };

let warned = false;

function isLocalUrl(url: string): boolean {
  return url.startsWith("file:") || url === ":memory:";
}

export function databaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const url = env.DATABASE_URL || LOCAL_DATABASE_URL;
  const authToken = env.DATABASE_AUTH_TOKEN || undefined;
  if (isLocalUrl(url)) return { url, authToken: undefined };

  const development = env.NODE_ENV === "development";
  if (development && env.ALLOW_REMOTE_DATABASE !== "true") {
    if (!warned) {
      warned = true;
      console.warn(
        `[db] next dev ignores the remote DATABASE_URL and uses ${LOCAL_DATABASE_URL}. ` +
          "Set ALLOW_REMOTE_DATABASE=true to develop against a remote database on purpose.",
      );
    }
    return { url: LOCAL_DATABASE_URL, authToken: undefined };
  }
  return { url, authToken };
}
