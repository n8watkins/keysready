"use client";

import { useState } from "react";
import PushButton from "@/components/PushButton";
import type { Booking } from "@/lib/types";

const FIELD =
  "w-full min-h-[48px] rounded-xl border border-neutral-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

// Local YYYY-MM-DD so the date picker can't offer a day in the past.
function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

// Lightweight client-side validation for instant feedback. The server stays the
// source of truth — this only catches obvious mistakes before a round trip.
function validate(payload: Record<string, string>): string | null {
  const required: Array<[keyof typeof payload, string]> = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["phone", "Mobile phone"],
    ["vehicle", "Vehicle"],
    ["issue", "What is going on"],
    ["preferredDate", "Preferred date"],
  ];
  for (const [key, label] of required) {
    if (!payload[key]?.trim()) return `${label} is required.`;
  }
  const digits = (payload.phone ?? "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Please enter a valid phone number.";
  }
  return null;
}

export default function BookPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const minDate = todayISO();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries()) as Record<string, string>;
    const validationError = validate(payload);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setBooking(data.booking as Booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book");
    } finally {
      setSubmitting(false);
    }
  }

  if (booking) {
    return (
      <div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-3xl" aria-hidden="true">✅</p>
          <h1 className="mt-2 text-2xl font-extrabold text-neutral-900">You are booked!</h1>
          <p className="mt-1 text-neutral-600">
            Reference{" "}
            <span className="font-mono font-bold text-neutral-900">{booking.ref}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {booking.vehicle} — {booking.issue}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 p-5">
          <h2 className="font-bold text-neutral-900">Get notified about your car</h2>
          <p className="mt-1 mb-4 text-sm text-neutral-600">
            We will push you the moment your repair status changes — no need to call.
          </p>
          <PushButton role="customer" bookingRef={booking.ref} phone={booking.phone} label="🔔 Notify me about my car" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-neutral-900">Book a repair</h1>
      <p className="mt-1 text-neutral-600">Takes about a minute. We will keep you posted.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">First name</span>
            <input name="firstName" required className={FIELD} autoComplete="given-name" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Last name</span>
            <input name="lastName" required className={FIELD} autoComplete="family-name" />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Mobile phone</span>
          <input name="phone" type="tel" required className={FIELD} autoComplete="tel" placeholder="+1 512 555 0147" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Vehicle</span>
          <input name="vehicle" required className={FIELD} placeholder="2018 Honda Civic" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">What is going on?</span>
          <textarea name="issue" required rows={3} className={FIELD} placeholder="Brakes squealing, AC not cold…" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Preferred date</span>
          <input name="preferredDate" type="date" required min={minDate} className={FIELD} />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[52px] w-full rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {submitting ? "Booking…" : "Book repair"}
        </button>
      </form>
    </div>
  );
}
