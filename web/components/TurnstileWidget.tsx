"use client";

import { useEffect, useRef, useState } from "react";

// Cloudflare Turnstile widget for the public forms. Fetches the site key,
// renders the challenge and reports the token (or null once it expires or
// errors). `resetKey` changes to ask for a fresh token: a token works once.

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    el: HTMLElement,
    opts: {
      sitekey: string;
      action: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("no turnstile")));
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  action,
  onToken,
  resetKey = 0,
}: {
  action: "booking" | "driver-signin";
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cb.current = onToken;
  });

  useEffect(() => {
    let widgetId: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/turnstile/site-key", { cache: "no-store" });
        if (!res.ok) throw new Error("no site key");
        const { siteKey } = (await res.json()) as { siteKey: string };
        const api = await loadTurnstile();
        if (cancelled || !box.current) return;
        widgetId = api.render(box.current, {
          sitekey: siteKey,
          action,
          callback: (token) => cb.current(token),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, resetKey]);

  return (
    <div>
      <div ref={box} data-testid="turnstile" className="min-h-[65px]" />
      {failed && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          The verification check could not load. Reload the page to try again.
        </p>
      )}
    </div>
  );
}
