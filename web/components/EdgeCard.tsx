import Link from "next/link";
import type { ReactNode } from "react";

/** The not-found and error pages: the KeysReady mark, a label, a heading, one
 *  sentence and the ways out, on one card. `inLayout` is for pages inside a
 *  layout that already has its own <main> and header. */
export default function EdgeCard({
  label,
  title,
  children,
  actions,
  inLayout = false,
}: {
  label: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  inLayout?: boolean;
}) {
  const card = (
    <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-extrabold text-neutral-900"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm text-white">
          KR
        </span>
        <span>KeysReady</span>
      </Link>
      <p className="mt-8 text-xs font-extrabold uppercase tracking-wider text-brand">
        {label}
      </p>
      <h1 className="mt-2 text-2xl font-extrabold text-balance text-neutral-900">
        {title}
      </h1>
      <p className="mt-2 text-sm text-pretty text-neutral-600">{children}</p>
      <div className="mt-6 flex flex-col gap-3">{actions}</div>
    </div>
  );
  if (inLayout) return <div className="flex justify-center py-10">{card}</div>;
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-50 px-4 py-16">
      {card}
    </main>
  );
}

export const primaryAction =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
export const secondaryAction =
  "inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border border-neutral-300 bg-white px-6 text-base font-semibold text-neutral-800 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";
