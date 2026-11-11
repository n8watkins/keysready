import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { consumeCap, ipKey, libsqlStore, type SqlStore } from "../lib/limits";

const OPTS = { secret: "test-secret", caps: { perIp: 2, site: 3 } };
const DAY1 = new Date("2026-11-10T10:00:00Z");

function store(): SqlStore {
  return libsqlStore(createClient({ url: ":memory:" }));
}

describe("consumeCap", () => {
  it("allows the per-IP cap, then refuses that IP only", async () => {
    const s = store();
    expect((await consumeCap(s, "booking", "1.1.1.1", { ...OPTS, now: DAY1 })).ok).toBe(true);
    expect((await consumeCap(s, "booking", "1.1.1.1", { ...OPTS, now: DAY1 })).ok).toBe(true);
    expect(await consumeCap(s, "booking", "1.1.1.1", { ...OPTS, now: DAY1 })).toEqual({ ok: false, reason: "ip" });
    expect((await consumeCap(s, "booking", "2.2.2.2", { ...OPTS, now: DAY1 })).ok).toBe(true);
  });

  it("does not let a refused IP use up the site-wide cap", async () => {
    const s = store();
    for (let i = 0; i < 6; i++) await consumeCap(s, "booking", "1.1.1.1", { ...OPTS, now: DAY1 });
    // 2 of 3 site units went to the first address only.
    expect((await consumeCap(s, "booking", "2.2.2.2", { ...OPTS, now: DAY1 })).ok).toBe(true);
  });

  it("refuses everyone past the site-wide cap", async () => {
    const s = store();
    for (const ip of ["1.1.1.1", "2.2.2.2", "3.3.3.3"]) {
      expect((await consumeCap(s, "booking", ip, { ...OPTS, now: DAY1 })).ok).toBe(true);
    }
    expect(await consumeCap(s, "booking", "4.4.4.4", { ...OPTS, now: DAY1 })).toEqual({ ok: false, reason: "site" });
  });

  it("keeps the two forms apart and resets on a new UTC day", async () => {
    const s = store();
    for (let i = 0; i < 3; i++) await consumeCap(s, "booking", "1.1.1.1", { ...OPTS, now: DAY1 });
    expect((await consumeCap(s, "driver-signin", "1.1.1.1", { ...OPTS, now: DAY1 })).ok).toBe(true);
    const next = new Date("2026-11-11T00:00:01Z");
    expect((await consumeCap(s, "booking", "1.1.1.1", { ...OPTS, now: next })).ok).toBe(true);
  });

  it("fails closed with no store or a failing store", async () => {
    expect(await consumeCap(null, "booking", "1.1.1.1", OPTS)).toEqual({ ok: false, reason: "unavailable" });
    const broken: SqlStore = { all: async () => { throw new Error("d1 down"); } };
    expect(await consumeCap(broken, "booking", "1.1.1.1", OPTS)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("stores a hash, never the address", async () => {
    const db = createClient({ url: ":memory:" });
    await consumeCap(libsqlStore(db), "booking", "203.0.113.9", { ...OPTS, now: DAY1 });
    const rows = (await db.execute("SELECT bucket FROM rate_counts")).rows.map((r) => String(r.bucket));
    expect(rows.some((b) => b.includes("203.0.113.9"))).toBe(false);
    expect(rows).toContain("booking:site");
  });
});

describe("ipKey", () => {
  it("keeps IPv4 and cuts IPv6 to its /64", () => {
    expect(ipKey("203.0.113.9")).toBe("203.0.113.9");
    expect(ipKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(ipKey("2001:db8:1:2::1"));
    expect(ipKey("2001:db8:1:2::1")).not.toBe(ipKey("2001:db8:1:3::1"));
  });
});
