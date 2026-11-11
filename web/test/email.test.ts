import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { reserveEmailSend, dailyCap } from "../lib/email-gate";
import { deliverMagicLink, type EmailBinding } from "../lib/email";

describe("daily cap", () => {
  it("allows up to the limit per UTC day, then refuses", async () => {
    const db = createClient({ url: ":memory:" });
    const day1 = new Date("2026-11-10T10:00:00Z");
    expect(await reserveEmailSend(db, "magic-link", day1, 2)).toBe(true);
    expect(await reserveEmailSend(db, "magic-link", day1, 2)).toBe(true);
    expect(await reserveEmailSend(db, "magic-link", day1, 2)).toBe(false);
    expect(await reserveEmailSend(db, "magic-link", new Date("2026-11-11T00:00:01Z"), 2)).toBe(true);
  });

  it("reads EMAIL_DAILY_CAP and falls back to the default", () => {
    expect(dailyCap({ EMAIL_DAILY_CAP: "7" })).toBe(7);
    expect(dailyCap({ EMAIL_DAILY_CAP: "junk" })).toBe(100);
    expect(dailyCap({})).toBe(100);
  });
});

describe("deliverMagicLink", () => {
  it("sends from the KeysReady address with html and text", async () => {
    const sent: Parameters<EmailBinding["send"]>[0][] = [];
    const res = await deliverMagicLink(
      { send: async (m) => void sent.push(m) },
      "a@b.co",
      "https://x.dev/v?t=1&u=2",
    );
    expect(res.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].from.email).toBe("keysready@n8builds.dev");
    expect(sent[0].to).toBe("a@b.co");
    expect(sent[0].html).toContain("t=1&amp;u=2");
    expect(sent[0].text).toContain("https://x.dev/v?t=1&u=2");
  });

  it("swallows binding errors", async () => {
    const res = await deliverMagicLink(
      { send: async () => { throw new Error("nope"); } },
      "a@b.co",
      "https://x.dev",
    );
    expect(res.ok).toBe(false);
  });
});
