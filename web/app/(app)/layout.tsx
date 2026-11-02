"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              QF
            </span>
            <span className="leading-tight">
              <span className="block font-bold text-neutral-900">QuickFix Auto</span>
              <span className="block text-[10px] uppercase tracking-wide text-neutral-500">
                powered by KeysReady
              </span>
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              Dashboard
            </Link>
            <button
              onClick={signOut}
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
