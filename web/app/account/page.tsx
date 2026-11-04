"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/better-auth-client";
import { LogoMark } from "@/components/LogoMark";

type Mode = "sign-in" | "sign-up";

export default function AccountPage() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("sign-up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: name || email, email, password })
          : await authClient.signIn.email({ email, password });
      if (res.error) setError(res.error.message || "Something went wrong");
      else refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const res = await authClient.signIn.social({ provider: "google", callbackURL: "/account" });
    if (res.error) setError(res.error.message || "Google sign-in isn’t configured yet");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 font-extrabold text-neutral-900">
        <LogoMark />
        KeysReady
      </Link>

      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
        <p className="inline-flex items-center rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand">
          Better Auth · preview
        </p>

        {isPending ? (
          <p className="mt-6 text-neutral-500">Loading…</p>
        ) : session ? (
          <div className="mt-5">
            <h1 className="text-2xl font-extrabold text-neutral-900">You’re signed in 🎉</h1>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="font-semibold text-neutral-500">Name</dt>
                <dd className="text-neutral-900">{session.user.name || "—"}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="font-semibold text-neutral-500">Email</dt>
                <dd className="text-neutral-900">{session.user.email}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="font-semibold text-neutral-500">User ID</dt>
                <dd className="font-mono text-xs text-neutral-700">{session.user.id}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={async () => {
                await authClient.signOut();
                refetch();
              }}
              className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-neutral-300 px-5 font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <h1 className="text-2xl font-extrabold text-neutral-900">
              {mode === "sign-up" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              {mode === "sign-up" ? "Sign up with email or Google." : "Sign in to continue."}
            </p>

            <button
              type="button"
              onClick={google}
              className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 font-semibold text-neutral-800 hover:bg-neutral-50"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
              </svg>
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" /> or <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "sign-up" && (
                <input
                  className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-brand"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <input
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-brand"
                placeholder="you@shop.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <input
                className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-brand"
                placeholder="Password (min 8 characters)"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              />
              {error && <p className="text-sm font-medium text-brand">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {busy ? "…" : mode === "sign-up" ? "Create account" : "Sign in"}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-neutral-500">
              {mode === "sign-up" ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "sign-up" ? "sign-in" : "sign-up");
                  setError(null);
                }}
                className="font-semibold text-brand hover:underline"
              >
                {mode === "sign-up" ? "Sign in" : "Create one"}
              </button>
            </p>
          </div>
        )}
      </div>

      <p className="mt-4 text-balance text-center text-xs text-neutral-400">
        Powered by Better Auth · separate from the demo shop login at{" "}
        <Link href="/login" className="underline">/login</Link>
      </p>
    </main>
  );
}
