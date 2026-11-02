"use client";

import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import PushButton from "@/components/PushButton";
import { STATUS_LABELS } from "@/lib/templates";
import type { Booking } from "@/lib/types";

const FIELD =
  "w-full min-h-[48px] rounded-xl border border-neutral-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

export default function StatusPage() {
  const [ref, setRef] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ref");
    // Deferred to a microtask so no state update runs synchronously in the effect.
    if (r) void Promise.resolve().then(() => setRef(r));
  }, []);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBooking(null);
    try {
      const url = `/api/bookings/${encodeURIComponent(ref.trim())}${
        phone.trim() ? `?phone=${encodeURIComponent(phone.trim())}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Not found");
      setBooking(data.booking as Booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-neutral-900">Track your repair</h1>
      <p className="mt-1 text-neutral-600">Enter your reference and phone to see live status.</p>

      <form onSubmit={lookup} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Reference</span>
          <input value={ref} onChange={(e) => setRef(e.target.value)} required className={`${FIELD} font-mono`} placeholder="BK-7F3A2K" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Mobile phone (the number on your booking)</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" required className={FIELD} placeholder="+1 512 555 0147" />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="min-h-[52px] w-full rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {loading ? "Looking up…" : "Check status"}
        </button>
      </form>

      {booking && (
        <div className="mt-8 rounded-2xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-neutral-900">{booking.vehicle}</p>
              <p className="text-sm text-neutral-500">Ref {booking.ref}</p>
            </div>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-3 text-sm text-neutral-600">{booking.issue}</p>
          <p className="mt-1 text-sm text-neutral-500">
            Current status: <strong>{STATUS_LABELS[booking.status]}</strong>
          </p>

          <div className="mt-5 border-t border-neutral-200 pt-5">
            <p className="mb-3 text-sm text-neutral-600">Get a push when this changes:</p>
            <PushButton role="customer" bookingRef={booking.ref} phone={phone} label="🔔 Notify me about my car" />
          </div>
        </div>
      )}
    </div>
  );
}
