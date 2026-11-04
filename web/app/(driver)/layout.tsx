"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/LogoMark";

const NAV = [
  { href: "/driver", label: "My Garage" },
  { href: "/driver", label: "My Repairs", hash: "#repairs" },
  { href: "/driver/book", label: "Book" },
] as const;

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // The login page is its own self-contained screen — no app chrome there.
  const isLogin = pathname?.startsWith("/driver/login");

  async function signOut() {
    try {
      await fetch("/api/auth/driver/logout", { method: "POST" });
    } finally {
      router.push("/driver/login");
      router.refresh();
    }
  }

  if (isLogin) {
    return <main className="flex min-h-full flex-1 flex-col">{children}</main>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <Link href="/driver" className="flex items-center gap-2 font-extrabold text-neutral-900">
            <LogoMark />
            KeysReady
          </Link>
          <button
            onClick={signOut}
            className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-md items-center gap-1 px-3 pb-2 text-sm font-medium">
          {NAV.map((item) => {
            // At most one item is active. "My Garage" and "My Repairs" share the
            // /driver path (Repairs only adds a #repairs hash, which usePathname
            // strips), so on /driver only the non-hash item highlights — never
            // both. Book is active only on its own route.
            const active =
              item.href === "/driver/book"
                ? pathname === "/driver/book"
                : pathname === "/driver" && !("hash" in item && item.hash);
            return (
              <Link
                key={item.label}
                href={`${item.href}${"hash" in item && item.hash ? item.hash : ""}`}
                className={`min-h-[44px] flex items-center rounded-lg px-3 ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
    </>
  );
}
