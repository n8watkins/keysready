"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import CarForm, { type NewCar } from "@/components/CarForm";
import MessageThread from "@/components/MessageThread";
import QuotePanelDriver from "@/components/QuotePanelDriver";
import PushButton from "@/components/PushButton";
import { STATUS_LABELS } from "@/lib/templates";
import type { BookingStatus } from "@/lib/types";

interface Car {
  id: string;
  year: number;
  make: string;
  model: string;
  plate?: string;
}

interface DriverBooking {
  ref: string;
  vehicle: string;
  issue: string;
  status: BookingStatus;
  etaDate?: string;
  preferredDate: string;
  createdAt: string;
}

export default function DriverHomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<DriverBooking[]>([]);
  const [showAddCar, setShowAddCar] = useState(false);
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [openEstimates, setOpenEstimates] = useState<Record<string, boolean>>({});

  // Any 401 means the driver cookie is missing/invalid — bounce to login.
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

  const load = useCallback(async () => {
    try {
      const meRes = await fetch("/api/driver/me");
      if (!guard(meRes)) return;

      const [carsRes, bookingsRes] = await Promise.all([
        fetch("/api/driver/cars"),
        fetch("/api/driver/bookings"),
      ]);
      if (!guard(carsRes) || !guard(bookingsRes)) return;

      if (carsRes.ok) {
        const data = await carsRes.json();
        setCars((data.cars ?? []) as Car[]);
      }
      if (bookingsRes.ok) {
        const data = await bookingsRes.json();
        setBookings((data.bookings ?? []) as DriverBooking[]);
      }
    } finally {
      setLoading(false);
    }
  }, [guard]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addCar(car: NewCar): Promise<boolean> {
    const res = await fetch("/api/driver/cars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(car),
    });
    if (!guard(res)) return false;
    if (!res.ok) return false;
    const data = await res.json();
    setCars((prev) => [...prev, data.car as Car]);
    setShowAddCar(false);
    return true;
  }

  async function deleteCar(id: string) {
    const prev = cars;
    setCars((cs) => cs.filter((c) => c.id !== id)); // optimistic
    const res = await fetch(`/api/driver/cars/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!guard(res)) return;
    if (!res.ok) setCars(prev); // roll back on failure
  }

  if (loading) {
    return (
      <p className="py-10 text-center text-neutral-500" aria-live="polite">
        Loading your garage…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href="/driver/book"
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 text-base font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">🔧</span> Book a repair
      </Link>

      {/* Push opt-in for this device — covers status updates and shop messages. */}
      <section
        aria-labelledby="notify-heading"
        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4"
      >
        <h2 id="notify-heading" className="mb-1 font-bold text-neutral-900">
          Stay in the loop
        </h2>
        <p className="mb-3 text-sm text-neutral-500">
          Get a push on this device when your repair status changes or the shop messages you.
        </p>
        <PushButton role="driver" />
      </section>

      {/* My Garage */}
      <section aria-labelledby="garage-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="garage-heading" className="text-lg font-extrabold text-neutral-900">
            My Garage
          </h2>
          {cars.length > 0 && (
            <button
              onClick={() => setShowAddCar((v) => !v)}
              className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-brand hover:bg-brand/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              aria-expanded={showAddCar}
            >
              {showAddCar ? "Cancel" : "+ Add car"}
            </button>
          )}
        </div>

        {cars.length === 0 && !showAddCar ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center">
            <p className="text-3xl" aria-hidden="true">🚗</p>
            <p className="mt-2 font-medium text-neutral-900">No cars saved yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              Add a car to book repairs faster next time.
            </p>
            <button
              onClick={() => setShowAddCar(true)}
              className="mt-4 min-h-[44px] rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Add your first car
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {cars.map((car) => (
              <li
                key={car.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">
                    {car.year} {car.make} {car.model}
                  </p>
                  {car.plate && (
                    <p className="text-sm uppercase tracking-wide text-neutral-500">{car.plate}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteCar(car.id)}
                  className="min-h-[44px] shrink-0 rounded-lg px-3 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  aria-label={`Remove ${car.year} ${car.make} ${car.model}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {showAddCar && (
          <div className="mt-4 rounded-2xl border border-neutral-200 p-4">
            <h3 className="mb-3 font-bold text-neutral-900">Add a car</h3>
            <CarForm onAdd={addCar} />
          </div>
        )}
      </section>

      {/* My Repairs */}
      <section aria-labelledby="repairs-heading" id="repairs" className="scroll-mt-28">
        <h2 id="repairs-heading" className="mb-3 text-lg font-extrabold text-neutral-900">
          My Repairs
        </h2>

        {bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center">
            <p className="text-3xl" aria-hidden="true">🔧</p>
            <p className="mt-2 font-medium text-neutral-900">No repairs yet</p>
            <p className="mt-1 text-sm text-neutral-500">
              When you book a repair, you can track its status here.
            </p>
            <Link
              href="/driver/book"
              className="mt-4 inline-flex min-h-[44px] items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Book a repair
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => (
              <li key={b.ref} className="rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900">{b.vehicle}</p>
                    <p className="font-mono text-xs text-neutral-500">Ref {b.ref}</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{b.issue}</p>
                <p className="mt-2 text-sm text-neutral-500">
                  Status: <strong className="text-neutral-700">{STATUS_LABELS[b.status]}</strong>
                  {b.etaDate && (
                    <>
                      {" "}· ETA <strong className="text-neutral-700">{b.etaDate}</strong>
                    </>
                  )}
                </p>

                {/* Messages with the shop, threaded to this booking. */}
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() =>
                      setOpenThreads((prev) => ({ ...prev, [b.ref]: !prev[b.ref] }))
                    }
                    className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-1 text-sm font-semibold text-brand hover:bg-brand/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-expanded={!!openThreads[b.ref]}
                    aria-controls={`messages-${b.ref}`}
                  >
                    <span>
                      <span aria-hidden="true">💬</span> Messages
                    </span>
                    <span aria-hidden="true">{openThreads[b.ref] ? "▲" : "▼"}</span>
                  </button>
                  {openThreads[b.ref] && (
                    <div id={`messages-${b.ref}`} className="mt-3">
                      <MessageThread bookingRef={b.ref} />
                    </div>
                  )}
                </div>

                {/* Estimate & payment for this repair. */}
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() =>
                      setOpenEstimates((prev) => ({
                        ...prev,
                        [b.ref]: !prev[b.ref],
                      }))
                    }
                    className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-1 text-sm font-semibold text-brand hover:bg-brand/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    aria-expanded={!!openEstimates[b.ref]}
                    aria-controls={`estimate-${b.ref}`}
                  >
                    <span>
                      <span aria-hidden="true">🧾</span> Estimate
                    </span>
                    <span aria-hidden="true">
                      {openEstimates[b.ref] ? "▲" : "▼"}
                    </span>
                  </button>
                  {openEstimates[b.ref] && (
                    <div id={`estimate-${b.ref}`} className="mt-3">
                      <QuotePanelDriver bookingRef={b.ref} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
