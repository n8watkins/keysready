"use client";

import { useEffect, useRef } from "react";
import { Bell, Check, CreditCard, FileText, Wrench } from "lucide-react";

/**
 * Illustrative hero: what a customer sees on their phone during one repair.
 * The shop, car and amounts are made up for the example.
 */
export function HeroDemo() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.animate = "true";
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[25rem] lg:mr-0">
      <div
        ref={ref}
        className="demo relative rounded-[2.25rem] border border-line-strong bg-surface p-3 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)]"
        role="img"
        aria-label="Example: a customer's phone receives a booking confirmation, an in-progress update, an estimate to approve and a ready-for-pickup notice from their repair shop."
      >
        <div className="rounded-[1.75rem] bg-bg-sunk p-4 sm:p-5">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted">
            <span>Riverside Auto</span>
            <span className="rounded-full border border-line-strong px-2 py-0.5">Example</span>
          </div>

          <div className="mt-4 rounded-2xl bg-surface p-4">
            <p className="text-xs text-muted">2019 Honda Civic · Brakes</p>
            <p className="mt-1 font-display text-lg font-extrabold tracking-tight">
              Ready for pickup <span className="text-ready">by 4:30</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="demo-progress h-full rounded-full bg-ready" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted">
              <span>Received</span>
              <span>In progress</span>
              <span className="font-semibold text-ready">Ready</span>
            </div>
          </div>

          <ul className="mt-3 space-y-2.5">
            <Notice stage={1} icon={<Check className="size-3.5" />} title="Booking confirmed" body="Drop-off Tuesday at 8:00." />
            <Notice stage={2} icon={<Wrench className="size-3.5" />} title="In progress" body="We're inspecting your brakes now." />
            <li className="demo-stage rounded-2xl border border-line bg-surface p-3.5" data-stage="3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-pending-soft text-pending">
                  <FileText className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Estimate ready: $412.80</p>
                  <p className="text-[13px] leading-snug text-muted">Front pads and rotors. Approve to start the work.</p>
                  <div className="mt-2.5 flex gap-2">
                    <span className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-xs font-semibold text-bg">Approve</span>
                    <span className="inline-flex h-8 items-center rounded-lg border border-line-strong px-3 text-xs font-semibold">Decline</span>
                  </div>
                </div>
              </div>
            </li>
            <li className="demo-stage rounded-2xl border border-ready/30 bg-ready-soft p-3.5" data-stage="4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-ready text-bg">
                  <Bell className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Your car is ready</p>
                  <p className="flex items-center gap-1.5 text-[13px] leading-snug text-muted">
                    <CreditCard className="size-3.5 shrink-0" aria-hidden="true" />
                    Paid $412.80. Keys are at the front desk.
                  </p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">Illustration of the customer view. Shop and amounts are examples.</p>
    </div>
  );
}

function Notice({
  stage,
  icon,
  title,
  body,
}: {
  stage: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="demo-stage flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5" data-stage={stage}>
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-bg-sunk text-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[13px] leading-snug text-muted">{body}</p>
      </div>
    </li>
  );
}
