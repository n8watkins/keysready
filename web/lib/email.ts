// Transactional email for KeysReady drivers (magic sign-in links).
//
// Server-only. Sends through the mailroom Worker (n8watkins/mailroom) over the
// MAILROOM service binding (wrangler.jsonc, app slice `keysready`). Mailroom
// holds the Cloudflare Email Service binding and enforces the caps (per
// recipient, per day, per month, all apps), the suppression list and
// idempotency, so this Worker has no binding that can send email by itself.
// When there is no binding (next dev, e2e) the link is printed to the server
// console instead, so the demo works with no account.
//
// This NEVER throws out to the request handler: leaking a failure (or a slow
// timeout) would let a caller probe whether an account exists, so all errors
// are swallowed and logged.

import { getCloudflareContext } from "@opennextjs/cloudflare";

const SUBJECT = "Your KeysReady sign-in link";
export const EMAIL_FROM = { email: "keysready@n8builds.dev", name: "KeysReady" };

export interface SendResult {
  ok: boolean;
}

/** The slice of mailroom's `send()` this module uses (mailroom src/types.ts). */
export interface MailroomRequest {
  kind: "signin";
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  fromName?: string;
  key?: string;
}

export type MailroomResult =
  | { ok: true; messageId: string; duplicate?: boolean }
  | { ok: false; code: string; retryable: boolean; message: string };

export interface MailroomBinding {
  send(request: MailroomRequest): Promise<MailroomResult>;
}

function mailroomBinding(): MailroomBinding | undefined {
  try {
    return (getCloudflareContext().env as { MAILROOM?: MailroomBinding }).MAILROOM;
  } catch {
    return undefined; // not running on the Worker (next dev, e2e)
  }
}

/** Sends one magic link through mailroom. Never throws. */
export async function deliverMagicLink(
  mailroom: MailroomBinding,
  toEmail: string,
  linkUrl: string,
  key?: string,
): Promise<SendResult> {
  try {
    const result = await mailroom.send({
      kind: "signin",
      to: toEmail,
      from: EMAIL_FROM.email,
      fromName: EMAIL_FROM.name,
      subject: SUBJECT,
      html: magicLinkHtml(linkUrl),
      text: magicLinkText(linkUrl),
      key,
    });
    if (!result.ok) {
      // A refusal (a cap, suppression) logs its code only, never an address.
      console.error(JSON.stringify({ event: "email_refused", kind: "magic-link", code: result.code }));
      return { ok: false };
    }
    console.log(JSON.stringify({ event: "email_sent", kind: "magic-link" }));
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

/**
 * Send a magic sign-in link to `toEmail`. Always resolves (never rejects) so
 * the /api/auth/driver/request handler stays constant-time and non-enumerating.
 * `tokenId` keys the send, so a retry of the same link goes out once.
 */
export async function sendMagicLink(
  toEmail: string,
  linkUrl: string,
  tokenId?: string,
): Promise<SendResult> {
  const mailroom = mailroomBinding();
  if (!mailroom) {
    // DEV FALLBACK: no binding. Print the link so the demo works.
    console.log(`[email:dev] magic link for ${toEmail} -> ${linkUrl}`);
    return { ok: true };
  }
  return deliverMagicLink(mailroom, toEmail, linkUrl, tokenId ? `signin-${tokenId.slice(0, 32)}` : undefined);
}

function magicLinkText(linkUrl: string): string {
  return [
    "Sign in to KeysReady",
    "",
    "Open this link to sign in. It expires in 20 minutes and can be used once:",
    linkUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");
}

// Simple, brand-consistent HTML body. Inline styles only (email clients strip
// <style>/external CSS). The link itself is always plain text too, so it works
// even when the button doesn't render.
function magicLinkHtml(linkUrl: string): string {
  const safeUrl = escapeHtml(linkUrl);
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a;">KeysReady</p>
                <h1 style="margin:16px 0 8px;font-size:22px;color:#0f172a;">Sign in to KeysReady</h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#475569;">
                  Tap the button below to sign in. This link expires in 20 minutes and can be used once.
                </p>
                <a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:8px;">Sign in</a>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">
                  Or paste this link into your browser:<br />
                  <a href="${safeUrl}" style="color:#2563eb;word-break:break-all;">${safeUrl}</a>
                </p>
                <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
                  If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
