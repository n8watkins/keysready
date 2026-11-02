"use client";

// Shop-side quote & invoice builder for a single booking. Lets staff add/edit
// line items (description + dollar amount), see a running total, and send the
// estimate to the customer. Money is shown in dollars but stored/sent as integer
// CENTS — see dollarsToCents / formatCents below. Lazily loads the current quote
// from GET /api/shop/quote?ref= the first time the panel is opened.

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

// Editable rows keep the dollar amount as a raw string so the field can be empty
// or mid-typing ("12.") without fighting the user. Converted to cents on save.
interface DraftRow {
  key: string;
  description: string;
  dollars: string;
}

const MAX_DESC = 200;

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

// "12.5" -> 1250, "" -> 0, garbage -> NaN. Rounds to the nearest cent.
function dollarsToCents(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function newKey(): string {
  return Math.random().toString(36).slice(2);
}

const QUOTE_BADGE: Record<QuoteStatus, { label: string; cls: string }> = {
  none: { label: "No estimate", cls: "bg-neutral-200 text-neutral-700" },
  draft: { label: "Draft", cls: "bg-amber-100 text-amber-800" },
  sent: { label: "Sent", cls: "bg-blue-100 text-blue-800" },
  approved: { label: "Approved", cls: "bg-indigo-100 text-indigo-800" },
  declined: { label: "Declined", cls: "bg-red-100 text-red-800" },
  paid: { label: "Paid", cls: "bg-green-100 text-green-800" },
};

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

export default function QuotePanelShop({ bookingRef }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const reqId = useRef(0);

  const applyQuote = useCallback((q: Quote) => {
    setQuote(q);
    setRows(
      q.items.map((it) => ({
        key: newKey(),
        description: it.description,
        dollars: centsToDollars(it.amountCents),
      })),
    );
  }, []);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoadError("");
    try {
      const res = await fetch(
        `/api/shop/quote?ref=${encodeURIComponent(bookingRef)}`,
        { cache: "no-store" },
      );
      if (id !== reqId.current) return;
      if (!res.ok) {
        setLoadError("Couldn't load the estimate.");
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as { quote: Quote } | Quote;
      const q = "quote" in data ? data.quote : data;
      applyQuote(q);
      setLoaded(true);
    } catch {
      if (id !== reqId.current) return;
      setLoadError("Couldn't load the estimate.");
      setLoaded(true);
    }
  }, [bookingRef, applyQuote]);

  useEffect(() => {
    void load();
  }, [load]);

  // Editing is locked once the customer has acted on the estimate.
  const editable =
    !quote || quote.status === "none" || quote.status === "draft";

  const runningCents = rows.reduce((sum, r) => {
    const c = dollarsToCents(r.dollars);
    return sum + (Number.isFinite(c) && c > 0 ? c : 0);
  }, 0);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, { key: newKey(), description: "", dollars: "" }]);
  }

  function removeRow(key: string) {
    setRows((rs) => rs.filter((r) => r.key !== key));
  }

  // Trim + drop empty rows, validate, and return cents-shaped items or null.
  function collectItems(): { description: string; amountCents: number }[] | null {
    const items: { description: string; amountCents: number }[] = [];
    for (const r of rows) {
      const description = r.description.trim();
      const hasText = description.length > 0;
      const hasAmount = r.dollars.trim().length > 0;
      if (!hasText && !hasAmount) continue; // blank row — skip
      if (!hasText) {
        setActionError("Every line item needs a description.");
        return null;
      }
      if (description.length > MAX_DESC) {
        setActionError(`Descriptions must be ${MAX_DESC} characters or fewer.`);
        return null;
      }
      const amountCents = dollarsToCents(r.dollars);
      if (!Number.isFinite(amountCents) || amountCents < 0) {
        setActionError(`Enter a valid amount for "${description}".`);
        return null;
      }
      items.push({ description, amountCents });
    }
    return items;
  }

  async function saveDraft(): Promise<boolean> {
    setActionError("");
    setNotice("");
    const items = collectItems();
    if (items === null) return false;
    setSaving(true);
    try {
      const res = await fetch("/api/shop/quote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: bookingRef, items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Couldn't save the estimate.");
        return false;
      }
      if (data.quote) applyQuote(data.quote as Quote);
      else await load();
      setNotice("Saved.");
      return true;
    } catch {
      setActionError("Network error — estimate not saved.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote() {
    setActionError("");
    setNotice("");
    // Persist any pending edits first so we never send a stale estimate.
    const ok = await saveDraft();
    if (!ok) return;
    if (runningCents <= 0 || rows.every((r) => !r.description.trim())) {
      setActionError("Add at least one line item before sending.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/shop/quote/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: bookingRef }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Couldn't send the estimate.");
        return;
      }
      if (data.quote) applyQuote(data.quote as Quote);
      else await load();
      const n = data.notified?.sent ?? 0;
      setNotice(
        n > 0
          ? `Sent — pushed ${n} notification${n === 1 ? "" : "s"} to the customer.`
          : "Sent to customer.",
      );
    } catch {
      setActionError("Network error — estimate not sent.");
    } finally {
      setSending(false);
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

  const badge = QUOTE_BADGE[quote?.status ?? "none"];
  const paid = quote?.paymentStatus === "paid";

  return (
    <section
      aria-label="Quote and invoice"
      className="rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
        >
          {badge.label}
        </span>
        {paid ? (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
            Paid{quote?.paidAt ? ` · ${formatDate(quote.paidAt)}` : ""}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
            Unpaid
          </span>
        )}
      </div>

      {editable ? (
        <>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.key} className="flex items-end gap-2">
                <div className="flex-1">
                  <label
                    htmlFor={`desc-${bookingRef}-${r.key}`}
                    className="sr-only"
                  >
                    Line item {i + 1} description
                  </label>
                  <input
                    id={`desc-${bookingRef}-${r.key}`}
                    type="text"
                    value={r.description}
                    maxLength={MAX_DESC}
                    placeholder="e.g. Front brake pads"
                    onChange={(e) =>
                      updateRow(r.key, { description: e.target.value })
                    }
                    className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3 text-base focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                </div>
                <div className="w-28">
                  <label
                    htmlFor={`amt-${bookingRef}-${r.key}`}
                    className="sr-only"
                  >
                    Line item {i + 1} amount in dollars
                  </label>
                  <div className="flex items-center rounded-xl border border-neutral-300 px-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand">
                    <span aria-hidden="true" className="text-neutral-500">
                      $
                    </span>
                    <input
                      id={`amt-${bookingRef}-${r.key}`}
                      type="text"
                      inputMode="decimal"
                      value={r.dollars}
                      placeholder="0.00"
                      onChange={(e) =>
                        updateRow(r.key, { dollars: e.target.value })
                      }
                      className="min-h-[44px] w-full bg-transparent px-1 text-base focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  aria-label={`Remove line item ${i + 1}`}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 min-h-[44px] rounded-lg px-2 text-sm font-semibold text-brand hover:bg-brand/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            + Add line item
          </button>

          <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
            <span className="text-sm font-medium text-neutral-500">Total</span>
            <span className="text-lg font-extrabold text-neutral-900">
              {formatCents(runningCents)}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving || sending}
              className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 px-4 font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => void sendQuote()}
              disabled={saving || sending}
              className="min-h-[44px] flex-1 rounded-xl bg-brand px-4 font-semibold text-white hover:bg-brand-dark disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {sending ? "Sending…" : "Send to customer"}
            </button>
          </div>
        </>
      ) : (
        // Locked view once the estimate has left the shop (sent/approved/etc.).
        <>
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
        </>
      )}

      {notice && (
        <p className="mt-3 text-sm text-green-700" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
