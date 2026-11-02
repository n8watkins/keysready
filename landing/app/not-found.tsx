import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { routes } from "@/lib/site";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <Nav />
      <main id="main" className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        <p className="font-mono text-sm font-semibold text-accent">404</p>
        <h1 className="mt-3 font-display text-4xl font-black tracking-tight text-balance">This page is not ready. Nor will it ever be.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">The page you asked for does not exist. These ones do:</p>
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {routes.map((r) => (
            <li key={r.path}>
              <Link href={r.path} className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-bg-sunk">
                <span>{r.title}</span>
                <span className="font-mono text-xs text-muted">{r.path}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-sm font-semibold text-bg hover:opacity-90">
          Back to the home page
        </Link>
      </main>
      <Footer />
    </>
  );
}
