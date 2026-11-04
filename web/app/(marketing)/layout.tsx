import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-neutral-900">
            <LogoMark />
            KeysReady
          </Link>
          <nav className="flex items-center gap-1 text-sm font-medium">
            <Link href="/pricing" className="hidden rounded-lg px-3 py-2 text-neutral-600 hover:bg-neutral-100 sm:inline-flex">
              Pricing
            </Link>
            <Link
              href="/driver/login"
              className="rounded-lg px-3 py-2 text-neutral-600 hover:bg-neutral-100"
            >
              For drivers
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-brand px-3 py-2 font-semibold text-white hover:bg-brand-dark"
            >
              Shop login
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© KeysReady — a working prototype.</p>
          <p className="flex gap-4">
            <Link href="/pricing" className="hover:text-neutral-800">Pricing</Link>
            <Link href="/status" className="hover:text-neutral-800">Track a repair</Link>
          </p>
        </div>
      </footer>
    </>
  );
}
