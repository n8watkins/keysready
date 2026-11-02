import Link from "next/link";
import type { Metadata } from "next";
import { TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — KeysReady",
  description: "Free unlimited push notifications. Add SMS when you need it.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-neutral-900 sm:text-4xl">
        Simple pricing. Free is actually free.
      </h1>
      <p className="mt-3 max-w-2xl text-neutral-600">
        Web push costs us nothing to send, so the free plan has no message cap.
        You only pay when you want SMS for customers who have not installed the app.
      </p>

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`flex flex-col rounded-2xl border p-6 ${
              t.highlight ? "border-brand ring-2 ring-brand/20" : "border-neutral-200"
            }`}
          >
            <h2 className="text-lg font-bold text-neutral-900">{t.name}</h2>
            <p className="mt-2">
              <span className="text-4xl font-extrabold text-neutral-900">{t.price}</span>
              <span className="text-neutral-500">{t.cadence}</span>
            </p>
            <p className="mt-3 text-sm text-neutral-600">{t.blurb}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-neutral-700">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-brand">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className={`mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl px-5 font-semibold ${
                t.highlight
                  ? "bg-brand text-white hover:bg-brand-dark"
                  : "border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-neutral-500">
        Multi-location? Multi-Shop is $149/location. SMS cost to us is ~$0.011–0.012
        per text; web push is ~$0 — which is why the free tier can stay free.
      </p>
    </div>
  );
}
