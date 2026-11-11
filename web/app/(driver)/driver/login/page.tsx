"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/LogoMark";
import { TurnstileWidget } from "@/components/TurnstileWidget";

const FIELD =
  "w-full min-h-[48px] rounded-xl border border-neutral-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export default function DriverLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);

  // The verify route redirects back here with ?error=expired on a stale link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "expired") {
      // Deferred to a microtask so no state update runs synchronously in the effect.
      void Promise.resolve().then(() =>
        setError("That sign-in link has expired or was already used. Enter your email to get a fresh one."),
      );
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Please complete the verification check first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/driver/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), turnstileToken: token }),
      });
      // The endpoint always returns 200 to avoid account enumeration; show the
      // same confirmation regardless so we don't leak whether an account exists.
      if (res.ok) {
        setSent(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      // A token works once: ask the widget for a fresh one.
      setToken(null);
      setWidgetKey((k) => k + 1);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" aria-label="KeysReady home" className="inline-flex">
            <LogoMark className="h-12 w-12" />
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">Driver sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Track your repairs and save your garage with <span className="font-medium">KeysReady</span>.
          </p>
        </div>

        {sent ? (
          <div
            className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center"
            role="status"
            aria-live="polite"
          >
            <p className="text-3xl" aria-hidden="true">📬</p>
            <h2 className="mt-2 text-lg font-bold text-neutral-900">Check your email</h2>
            <p className="mt-1 text-sm text-neutral-600">
              We sent a sign-in link to <span className="font-medium">{email.trim()}</span>. Open it on
              this device to continue.
            </p>
            <button
              onClick={() => {
                setSent(false);
                setError(null);
              }}
              className="mt-4 min-h-[44px] text-sm font-medium text-brand hover:text-brand-dark focus:outline-none focus-visible:underline"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-neutral-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoCapitalize="none"
                inputMode="email"
                className={FIELD}
                placeholder="you@example.com"
              />
            </label>

            <TurnstileWidget action="driver-signin" onToken={setToken} resetKey={widgetKey} />

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !token}
              className="min-h-[52px] w-full rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {submitting ? "Sending…" : "Email me a sign-in link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-neutral-400">
          Demo note: if no email arrives, the sign-in link is printed in the server console.
        </p>
        <p className="mt-4 text-center text-xs text-neutral-500">
          Run a shop?{" "}
          <Link href="/login" className="font-medium text-neutral-700 hover:text-neutral-900 hover:underline">
            Shop login
          </Link>
        </p>
      </div>
    </div>
  );
}
