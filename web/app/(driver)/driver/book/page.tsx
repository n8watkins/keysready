"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PushButton from "@/components/PushButton";

const FIELD =
  "w-full min-h-[48px] rounded-xl border border-neutral-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

interface Car {
  id: string;
  year: number;
  make: string;
  model: string;
  plate?: string;
}

interface CreatedBooking {
  ref: string;
  vehicle: string;
  issue: string;
  phone: string;
}

// Local YYYY-MM-DD so the date picker can't offer a day in the past.
function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function DriverBookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<Car[]>([]);
  const [carId, setCarId] = useState("");
  const [issue, setIssue] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<CreatedBooking | null>(null);
  const minDate = todayISO();

  const guard = useCallback(
    (res: Response): boolean => {
      if (res.status === 401) {
        router.replace("/driver/login");
        return false;
      }
      return true;
    },
    [router],
  );

  useEffect(() => {
    (async () => {
      try {
        const [meRes, carsRes] = await Promise.all([
          fetch("/api/driver/me"),
          fetch("/api/driver/cars"),
        ]);
        if (!guard(meRes) || !guard(carsRes)) return;

        if (meRes.ok) {
          const data = await meRes.json();
          if (data.driver?.phone) setPhone(data.driver.phone as string);
        }
        if (carsRes.ok) {
          const data = await carsRes.json();
          const list = (data.cars ?? []) as Car[];
          setCars(list);
          if (list.length > 0) setCarId(list[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [guard]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!carId) {
      setError("Please choose a car.");
      return;
    }
    if (!issue.trim()) {
      setError("Please describe what's going on.");
      return;
    }
    if (!preferredDate) {
      setError("Please pick a preferred date.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) {
      setError("Please enter a valid phone number.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/driver/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carId,
          issue: issue.trim(),
          preferredDate,
          phone: phone.trim(),
        }),
      });
      if (!guard(res)) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setBooking(data.booking as CreatedBooking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <p className="py-10 text-center text-neutral-500" aria-live="polite">
        Loading…
      </p>
    );
  }

  // Success screen
  if (booking) {
    return (
      <div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <p className="text-3xl" aria-hidden="true">✅</p>
          <h1 className="mt-2 text-2xl font-extrabold text-neutral-900">You&rsquo;re booked!</h1>
          <p className="mt-1 text-neutral-600">
            Reference <span className="font-mono font-bold text-neutral-900">{booking.ref}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {booking.vehicle} — {booking.issue}
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-neutral-200 p-5">
          <h2 className="font-bold text-neutral-900">Get notified about your car</h2>
          <p className="mt-1 mb-4 text-sm text-neutral-600">
            We&rsquo;ll push you the moment your repair status changes — no need to call.
          </p>
          <PushButton
            role="customer"
            bookingRef={booking.ref}
            phone={booking.phone}
            label="🔔 Notify me about my car"
          />
        </div>

        <Link
          href="/driver"
          className="mt-6 flex min-h-[48px] w-full items-center justify-center rounded-xl border border-neutral-300 px-6 text-base font-semibold text-neutral-700 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Back to my garage
        </Link>
      </div>
    );
  }

  // No saved cars — prompt to add one first.
  if (cars.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-extrabold text-neutral-900">Book a repair</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-6 text-center">
          <p className="text-3xl" aria-hidden="true">🚗</p>
          <p className="mt-2 font-medium text-neutral-900">Add a car first</p>
          <p className="mt-1 text-sm text-neutral-500">
            We need a vehicle on file before you can book a repair.
          </p>
          <Link
            href="/driver"
            className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            Go to My Garage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-neutral-900">Book a repair</h1>
      <p className="mt-1 text-neutral-600">Pick a car and tell us what&rsquo;s going on.</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Car</span>
          <select
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
            required
            className={FIELD}
          >
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.year} {c.make} {c.model}
                {c.plate ? ` · ${c.plate}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">What&rsquo;s going on?</span>
          <textarea
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            required
            rows={3}
            className={FIELD}
            placeholder="Brakes squealing, AC not cold…"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Preferred date</span>
          <input
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            type="date"
            required
            min={minDate}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Mobile phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            className={FIELD}
            placeholder="+1 512 555 0147"
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[52px] w-full rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          {submitting ? "Booking…" : "Book repair"}
        </button>
      </form>
    </div>
  );
}
