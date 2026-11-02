// Browser-side Web Push helpers. Imported only by client components.

import type { SubscriberRole } from "./types";

export interface PushSupport {
  supported: boolean;
  reason?: string;
  needsInstall?: boolean; // iOS: must be added to Home Screen first
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") return { supported: false, reason: "ssr" };
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason:
        "Notifications need a secure address. Open this at http://localhost:2323 on this computer, or an https:// URL — not a http:// IP like 192.168.x.x (e.g. when testing from a phone on your network).",
    };
  }
  if (!("serviceWorker" in navigator)) return { supported: false, reason: "No service worker support" };
  if (!("PushManager" in window)) return { supported: false, reason: "No Push API support" };
  if (!("Notification" in window)) return { supported: false, reason: "No Notifications support" };
  // iOS only delivers web push to an installed (Home Screen) PWA.
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIOS && !isStandalone) {
    return { supported: false, needsInstall: true, reason: "On iPhone/iPad, add to Home Screen first to enable alerts." };
  }
  return { supported: true };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getVapidPublicKey(): Promise<string | null> {
  const fromEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromEnv) return fromEnv;
  try {
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return null;
    return (await res.json()).publicKey ?? null;
  } catch {
    return null;
  }
}

export interface SubscribeResult {
  ok: boolean;
  error?: string;
}

export async function subscribeToPush(
  role: SubscriberRole,
  bookingRef?: string,
  phone?: string,
): Promise<SubscribeResult> {
  const support = getPushSupport();
  if (!support.supported) return { ok: false, error: support.reason };

  if (Notification.permission === "denied") {
    return {
      ok: false,
      error:
        "Notifications are blocked for this site. Reset them: click the lock / ⓘ icon left of the address bar → Notifications → Allow (or Reset), then reload. Also make sure your OS lets your browser show notifications (and Focus/Do-Not-Disturb is off).",
    };
  }
  const permission = await Notification.requestPermission();
  if (permission === "denied") {
    return {
      ok: false,
      error:
        "You blocked notifications. Reset via the lock / ⓘ icon in the address bar → Notifications → Allow, then reload and try again.",
    };
  }
  if (permission !== "granted") {
    return { ok: false, error: "The prompt was dismissed — tap the button again and choose Allow." };
  }

  const publicKey = await getVapidPublicKey();
  if (!publicKey) return { ok: false, error: "Push not configured on the server" };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  // Driver subscriptions are bound to the signed-in driver server-side (no
  // bookingRef/phone). Customer subscriptions must prove booking ownership: the
  // endpoint requires a phone that matches the booking's phone (full match).
  const payload: {
    role: SubscriberRole;
    subscription: PushSubscriptionJSON;
    bookingRef?: string;
    phone?: string;
  } = { role, subscription: sub.toJSON() };
  if (role !== "driver") {
    payload.bookingRef = bookingRef;
    payload.phone = phone;
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    return { ok: false, error: msg.error || "Failed to register subscription" };
  }
  return { ok: true };
}
