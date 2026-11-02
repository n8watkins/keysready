// Transactional email for KeysReady drivers (magic sign-in links).
//
// Server-only. Sends via Brevo's HTTP API (BREVO_API_KEY) — the primary
// provider — falling back to Resend (RESEND_API_KEY) if that's what's
// configured, and to a DEV FALLBACK that prints the link to the server console
// when no provider is set, so the demo works with no third-party account.
//
// Both providers are plain HTTPS APIs (no SMTP, no Node-only deps), so this runs
// unchanged on Vercel's Node runtime AND on Cloudflare Workers. This NEVER
// throws out to the request handler — leaking a failure (or a slow timeout)
// would let a caller probe whether an account exists, so all errors are
// swallowed and logged.

const SUBJECT = "Your KeysReady sign-in link";

export interface SendResult {
  ok: boolean;
}

interface Sender {
  name: string;
  email: string;
}

/**
 * Send a magic sign-in link to `toEmail`.
 *
 * Provider order: Brevo (BREVO_API_KEY) → Resend (RESEND_API_KEY) → dev console.
 * Always resolves (never rejects) so the /api/auth/driver/request handler can
 * stay constant-time and non-enumerating.
 */
export async function sendMagicLink(
  toEmail: string,
  linkUrl: string,
): Promise<SendResult> {
  const html = magicLinkHtml(linkUrl);

  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) return sendViaBrevo(brevoKey, toEmail, html);

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return sendViaResend(resendKey, toEmail, html);

  // DEV FALLBACK — no provider configured. Print the link so the demo works.
  console.log(`[email:dev] magic link for ${toEmail} -> ${linkUrl}`);
  return { ok: true };
}

/** POST https://api.brevo.com/v3/smtp/email — header is `api-key`, not Bearer. */
async function sendViaBrevo(
  apiKey: string,
  toEmail: string,
  html: string,
): Promise<SendResult> {
  const sender = parseSender(process.env.EMAIL_FROM);
  if (!sender) {
    console.error("[email] EMAIL_FROM is missing or malformed; Brevo needs a verified sender");
    return { ok: false };
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: toEmail }],
        subject: SUBJECT,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      // Log but do NOT throw — the caller must still return a generic 200.
      const detail = await res.text().catch(() => "");
      console.error(`[email] Brevo send failed (${res.status}): ${detail}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] Brevo request error:", err);
    return { ok: false };
  }
}

/** POST https://api.resend.com/emails — kept as a fallback provider. */
async function sendViaResend(
  apiKey: string,
  toEmail: string,
  html: string,
): Promise<SendResult> {
  const from = process.env.EMAIL_FROM || "KeysReady <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [toEmail], subject: SUBJECT, html }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend send failed (${res.status}): ${detail}`);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] Resend request error:", err);
    return { ok: false };
  }
}

/**
 * Parse EMAIL_FROM into Brevo's {name, email} sender object. Accepts either
 * "Name <email@host>" or a bare "email@host"; returns null when it is missing
 * or malformed (there is no default sender: it must be a verified address).
 */
function parseSender(from: string | undefined): Sender | null {
  if (!from) return null;
  const m = from.match(/^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/);
  if (m && m[2].includes("@")) return { name: m[1] || "KeysReady", email: m[2] };
  const bare = from.trim();
  return bare.includes("@") ? { name: "KeysReady", email: bare } : null;
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
