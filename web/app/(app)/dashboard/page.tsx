"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import PushButton from "@/components/PushButton";
import MessageThread from "@/components/MessageThread";
import QuotePanelShop from "@/components/QuotePanelShop";
import { type Booking, type BookingStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/templates";

type Toast = { kind: "ok" | "error"; text: string };

// Client-safe mirror of the server's transition rules (lib/store.ts is the
// authoritative gate — it rejects illegal PATCHes with a 409). We can't import
// store.ts here: it pulls in the libSQL/Node-crypto server modules. Keep the two
// in sync.
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** The statuses staff may select from `from`, including `from` itself. */
function allowedNextStatuses(from: BookingStatus): BookingStatus[] {
  return [from, ...(TRANSITIONS[from] ?? [])];
}

export default function DashboardPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, BookingStatus>>({});
  const [savingRef, setSavingRef] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [openQuote, setOpenQuote] = useState<string | null>(null);

  const showToast = useCallback((t: Toast) => {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/bookings");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setLoadError("Couldn't load bookings. Please try again.");
        return;
      }
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch {
      setLoadError("Network error while loading bookings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    // Deferred to a microtask so no state update runs synchronously in the effect.
    void Promise.resolve().then(load);
  }, [load]);

  async function save(ref: string) {
    const status = pending[ref];
    if (!status) return;
    setSavingRef(ref);
    try {
      const res = await fetch(`/api/bookings/${ref}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({ kind: "error", text: data.error || "Update failed. Please try again." });
        return;
      }
      setBookings((bs) => bs.map((b) => (b.ref === ref ? data.booking : b)));
      setPending((p) => {
        const next = { ...p };
        delete next[ref];
        return next;
      });
      const n = data.notified?.sent ?? 0;
      showToast({
        kind: "ok",
        text:
          n > 0
            ? `Updated — pushed ${n} customer notification${n === 1 ? "" : "s"}.`
            : "Updated. (No customer subscribed to push yet.)",
      });
    } catch {
      showToast({ kind: "error", text: "Network error — update not saved." });
    } finally {
      setSavingRef(null);
    }
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900">Shop dashboard</h1>
          <p className="text-sm text-neutral-500">QuickFix Auto · demo</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50">
            Refresh
          </button>
          <button onClick={signOut} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <h2 className="font-bold text-neutral-900">Get pinged on new bookings</h2>
        <p className="mt-1 mb-4 text-sm text-neutral-600">
          Turn on alerts and we will push your phone the moment a customer books.
        </p>
        <PushButton role="staff" label="🔔 Enable booking alerts" />
      </div>

      {toast && (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            toast.kind === "ok"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
          role={toast.kind === "ok" ? "status" : "alert"}
        >
          {toast.text}
        </p>
      )}

      <h2 className="mt-8 mb-3 text-lg font-bold text-neutral-900">Bookings</h2>

      {loading ? (
        <p className="text-neutral-500">Loading…</p>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            onClick={load}
            className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Retry
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-neutral-500">No bookings yet.</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const selected = pending[b.ref] ?? b.status;
            const dirty = Boolean(pending[b.ref]) && pending[b.ref] !== b.status;
            const options = allowedNextStatuses(b.status);
            return (
              <li key={b.ref} className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-neutral-900">{b.vehicle}</p>
                    <p className="text-sm text-neutral-500">
                      {b.firstName} {b.lastName} · <span className="font-mono">{b.ref}</span>
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{b.issue}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor={`status-${b.ref}`}>Update status</label>
                  <select
                    id={`status-${b.ref}`}
                    value={selected}
                    disabled={options.length <= 1}
                    onChange={(e) =>
                      setPending((p) => ({ ...p, [b.ref]: e.target.value as BookingStatus }))
                    }
                    className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 px-3 text-base disabled:bg-neutral-100 disabled:text-neutral-500"
                  >
                    {options.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => save(b.ref)}
                    disabled={!dirty || savingRef === b.ref}
                    className="min-h-[44px] rounded-xl bg-brand px-5 font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
                  >
                    {savingRef === b.ref ? "Saving…" : "Save & notify"}
                  </button>
                </div>

                <div className="mt-4 border-t border-neutral-100 pt-3">
                  {b.hasDriver ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenThread((cur) => (cur === b.ref ? null : b.ref))
                        }
                        aria-expanded={openThread === b.ref}
                        aria-controls={`messages-${b.ref}`}
                        className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                      >
                        <span>💬 Messages</span>
                        <span aria-hidden="true" className="text-neutral-400">
                          {openThread === b.ref ? "▲" : "▼"}
                        </span>
                      </button>
                      {openThread === b.ref && (
                        <div id={`messages-${b.ref}`} className="mt-3">
                          <MessageThread bookingRef={b.ref} />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="px-2 text-sm text-neutral-400">
                      No customer account on this booking
                    </p>
                  )}
                </div>

                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenQuote((cur) => (cur === b.ref ? null : b.ref))
                    }
                    aria-expanded={openQuote === b.ref}
                    aria-controls={`quote-${b.ref}`}
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-2 text-left text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <span>🧾 Quote &amp; invoice</span>
                    <span aria-hidden="true" className="text-neutral-400">
                      {openQuote === b.ref ? "▲" : "▼"}
                    </span>
                  </button>
                  {openQuote === b.ref && (
                    <div id={`quote-${b.ref}`} className="mt-3">
                      <QuotePanelShop bookingRef={b.ref} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
