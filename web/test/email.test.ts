import { describe, expect, it } from "vitest";
import { deliverMagicLink, type MailroomBinding, type MailroomRequest } from "../lib/email";

describe("deliverMagicLink", () => {
  it("sends a signin through mailroom from the KeysReady address with html and text", async () => {
    const sent: MailroomRequest[] = [];
    const res = await deliverMagicLink(
      { send: async (m) => (sent.push(m), { ok: true, messageId: "m1" }) },
      "a@b.co",
      "https://x.dev/v?t=1&u=2",
      "signin-abc",
    );
    expect(res.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe("signin");
    expect(sent[0].from).toBe("keysready@n8builds.dev");
    expect(sent[0].to).toBe("a@b.co");
    expect(sent[0].key).toBe("signin-abc");
    expect(sent[0].html).toContain("t=1&amp;u=2");
    expect(sent[0].text).toContain("https://x.dev/v?t=1&u=2");
  });

  it("reports a mailroom refusal as not sent", async () => {
    const mailroom: MailroomBinding = {
      send: async () => ({ ok: false, code: "cap_app_day", retryable: true, message: "cap" }),
    };
    expect((await deliverMagicLink(mailroom, "a@b.co", "https://x.dev")).ok).toBe(false);
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
