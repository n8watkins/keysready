// Web Push wrapper (server-only). Free to send — browser push services
// (FCM / APNs / Mozilla autopush) carry the message at no per-message cost.
//
// SMS later plugs in alongside this behind the same notification layer
// (see lib/notifications.ts and server/src/notifications for the full engine).

import webpush from 'web-push';
import type { PushSubscriptionJSONLike } from './types';

let configured = false;

/**
 * Returns true if VAPID keys AND a real contact subject are present so web-push
 * is ready to send. VAPID_SUBJECT must be a genuine mailto:/https: abuse contact;
 * we deliberately do NOT invent one (a bogus address gets registered with the push
 * service and can get the application server flagged).
 */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );
}

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  // Require a real abuse-contact subject — never silently use a placeholder mailto.
  const subject = process.env.VAPID_SUBJECT;
  if (!subject) {
    console.warn(
      '[push] VAPID_SUBJECT is not set. Set it to a real mailto: or https: contact ' +
        '(e.g. mailto:ops@yourdomain.com); refusing to register a placeholder abuse contact. ' +
        'Push is disabled until configured.',
    );
    return false;
  }
  // NOTE: NEXT_PUBLIC_VAPID_PUBLIC_KEY (used by the browser to subscribe) MUST match
  // VAPID_PUBLIC_KEY (used here to sign). A mismatch makes the push service silently
  // drop messages with a 403 — no delivery, no error surfaced to the user.
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface PushResult {
  ok: boolean;
  /** true when the subscription is gone (404/410) and should be deleted. */
  expired: boolean;
  error?: string;
}

export async function sendPush(
  subscription: PushSubscriptionJSONLike,
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureConfigured()) {
    // Not configured (e.g. no VAPID keys): treat as a no-op so the app still works.
    console.warn('[push] VAPID not configured — skipping send.');
    return { ok: false, expired: false, error: 'not_configured' };
  }
  try {
    await webpush.sendNotification(
      subscription as unknown as Parameters<typeof webpush.sendNotification>[0],
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || '/',
        tag: payload.tag,
      }),
    );
    return { ok: true, expired: false };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    const expired = statusCode === 404 || statusCode === 410;
    const message = err instanceof Error ? err.message : String(err);
    if (statusCode === 403) {
      // Almost always a VAPID key mismatch: the public key the browser subscribed with
      // does not match VAPID_PUBLIC_KEY here, so the push service rejects the signature.
      console.error(
        '[push] 403 from push service — likely VAPID key mismatch ' +
          '(NEXT_PUBLIC_VAPID_PUBLIC_KEY must match VAPID_PUBLIC_KEY):',
        message,
      );
    } else if (!expired) {
      console.error('[push] send failed:', message);
    }
    return { ok: false, expired, error: message };
  }
}
