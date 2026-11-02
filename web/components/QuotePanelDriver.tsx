"use client";

// Driver-side estimate panel for a single repair. Mirrors the shop's quote:
//   - status 'sent'      -> show line items + total + Approve / Decline
//   - status 'approved'  -> show a Pay button (Stripe redirect OR sim confirm)
//   - paid               -> "Paid ✓ <date>"
// Amounts arrive as integer CENTS from GET /api/driver/quote?ref= and are shown
// to the driver in dollars. Pay flow per the pinned contract:
//   POST /api/driver/pay -> { mode:'stripe', url } => window.location = url
//                        -> { mode:'sim' }        => POST /api/driver/pay/confirm

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  bookingRef: string;
}

type QuoteStatus = "none" | "draft" | "sent" | "approved" | "declined" | "paid";
type PaymentStatus = "unpaid" | "paid";

interface QuoteItem {
  id: string;
  description: string;
  amountCents: number;
}

interface Quote {
  status: QuoteStatus;
  totalCents: number;
  paymentStatus: PaymentStatus;
  paidAt: string | null;
  items: QuoteItem[];
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function QuotePanelDriver({ bookingRef }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "decline" | "pay">(null);
  const [actionError, setActionError] = useState("");

  const reqId = useRef(0);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoadError("");
    try {
      const res = await fetch(
        `/api/driver/quote?ref=${encodeURIComponent(bookingRef)}`,
        { cache: "no-store" },
      );
      if (id !== reqId.current) return;
      if (!res.ok) {
        setLoadError("Couldn't load your estimate.");
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as { quote: Quote } | Quote;
      const q = "quote" in data ? data.quote : data;
      setQuote(q);
      setLoaded(true);
    } catch {
      if (id !== reqId.current) return;
      setLoadError("Couldn't load your estimate.");
      setLoaded(true);
    }
  }, [bookingRef]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(kind: "approve" | "decline") {
    setActionError("");
    setBusy(kind);
    try {
      const res = await fetch(`/api/driver/quote/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: bookingRef }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Something went wrong. Please try again.");
        return;
      }
      if (data.quote) setQuote(data.quote as Quote);
      else await load();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function pay() {
    setActionError("");
    setBusy("pay");
    try {
      const res = await fetch("/api/driver/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: bookingRef }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Couldn't start payment. Please try again.");
        return;
      }
      if (data.mode === "stripe" && data.url) {
        // Hand off to Stripe Checkout; we return via successUrl (?paid=1).
        window.location.href = data.url as string;
        return;
      }
      // Demo / sim mode — confirm the payment server-side, then reflect "Paid".
      const confirmRes = await fetch("/api/driver/pay/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: bookingRef }),
      });
      const confirmData = await confirmRes.json().catch(() => ({}));
      if (!confirmRes.ok) {
        setActionError(confirmData.error || "Payment couldn't be confirmed.");
        return;
      }
      if (confirmData.quote) setQuote(confirmData.quote as Quote);
      else await load();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) {
    return (
      <p className="px-1 py-2 text-sm text-neutral-400" aria-live="polite">
        Loading estimate…
      </p>
    );
  }

  if (loadError) {
    return (
      <div className="px-1 py-2">
        <p className="text-sm text-red-600" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 min-h-[44px] rounded-lg border border-neutral-300 px-3 text-sm font-medium hover:bg-neutral-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const status = quote?.status ?? "none";
  const paid = quote?.paymentStatus === "paid";

  // Nothing for the driver to act on until the shop sends an estimate.
  if (!paid && (status === "none" || status === "draft")) {
    return (
      <p className="px-1 py-2 text-sm text-neutral-500">
        No estimate yet — the shop will send one when it&apos;s ready.
      </p>
    );
  }

  return (
    <section
      aria-label="Estimate"
      className="rounded-2xl border border-neutral-200 bg-white p-4"
    >
      {paid ? (
        <div>
          <p className="text-base font-bold text-green-700">
            Paid <span aria-hidden="true">✓</span>
            {quote?.paidAt ? ` · ${formatDate(quote.paidAt)}` : ""}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-neutral-500">Total paid</span>
            <span className="font-extrabold text-neutral-900">
              {formatCents(quote?.totalCents ?? 0)}
            </span>
          </div>
        </div>
      ) : (
        <>
          {status === "declined" && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              You declined this estimate. Message the shop if you have questions.
            </p>
          )}

          <ul className="divide-y divide-neutral-100">
            {(quote?.items ?? []).map((it) => (
              <li
                key={it.id}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="text-sm text-neutral-700">
                  {it.description}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900">
                  {formatCents(it.amountCents)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-sm font-medium text-neutral-500">Total</span>
            <span className="text-lg font-extrabold text-neutral-900">
              {formatCents(quote?.totalCents ?? 0)}
            </span>
          </div>

          {status === "sent" && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void decide("decline")}
                disabled={busy !== null}
                className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 px-4 font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
              >
                {busy === "decline" ? "…" : "Decline"}
              </button>
              <button
                type="button"
                onClick={() => void decide("approve")}
                disabled={busy !== null}
                className="min-h-[44px] flex-1 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
          )}

          {status === "approved" && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void pay()}
                disabled={busy !== null}
                className="min-h-[44px] w-full rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {busy === "pay"
                  ? "Processing…"
                  : `Pay ${formatCents(quote?.totalCents ?? 0)}`}
              </button>
            </div>
          )}
        </>
      )}

      {actionError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
