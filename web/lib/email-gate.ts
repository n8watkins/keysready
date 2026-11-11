// Daily send cap for outgoing email. Cloudflare Email Service bills past its
// included monthly amount and has no per-app cap, so the app keeps its own.
//
// One row per UTC day and kind in `email_sends`. The table holds counts only,
// never an address, so a future admin page can read it.

import type { Client } from "@libsql/client";

export const DEFAULT_DAILY_CAP = 100;

export function dailyCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.EMAIL_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

/**
 * Spend one send from today's site-wide cap. Returns false (and spends
 * nothing) once the cap is used up.
 */
export async function reserveEmailSend(
  db: Pick<Client, "execute">,
  kind: string,
  now: Date = new Date(),
  cap: number = dailyCap(),
): Promise<boolean> {
  await db.execute(`CREATE TABLE IF NOT EXISTS email_sends (
    day TEXT NOT NULL,
    kind TEXT NOT NULL,
    n INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, kind)
  )`);
  const day = now.toISOString().slice(0, 10);
  const total = await db.execute({
    sql: `SELECT COALESCE(SUM(n), 0) AS n FROM email_sends WHERE day = ?`,
    args: [day],
  });
  if (Number(total.rows[0].n) >= cap) return false;
  await db.execute({
    sql: `INSERT INTO email_sends (day, kind, n) VALUES (?, ?, 1)
          ON CONFLICT (day, kind) DO UPDATE SET n = n + 1`,
    args: [day, kind],
  });
  return true;
}
