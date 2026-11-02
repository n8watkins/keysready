"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIELD =
  "w-full min-h-[48px] rounded-xl border border-neutral-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Sign in failed. Please try again.");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white">
            QF
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">Staff sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">
            QuickFix Auto · <span className="font-medium">powered by KeysReady</span>
          </p>
        </div>

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
              className={FIELD}
              placeholder="you@yourshop.com"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={FIELD}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-[52px] w-full rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
