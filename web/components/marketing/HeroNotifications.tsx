"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/LogoMark";

/** The kinds of pushes a shop fires across a single repair — cycled in the hero. */
const NOTIFS = [
  {
    tag: "Ready",
    dot: "bg-green-500",
    title: "Your car is ready for pickup 🎉",
    body: "2018 Civic · brakes done. Tap to pay and grab your keys.",
    foot: "Delivered free over Web Push — no text sent",
  },
  {
    tag: "Estimate",
    dot: "bg-amber-500",
    title: "Estimate ready — $312.40",
    body: "Front pads + rotors. Approve from your phone to start work.",
    foot: "Customer approves & pays in one tap",
  },
  {
    tag: "In progress",
    dot: "bg-blue-500",
    title: "We’ve started your repair",
    body: "On the lift now — estimated ready by 4:30pm.",
    foot: "Auto-sent the moment status changed",
  },
  {
    tag: "Paid",
    dot: "bg-green-500",
    title: "Payment received — $312.40",
    body: "Thanks! Your receipt is saved in your garage.",
    foot: "Money collected before pickup",
  },
];

export default function HeroNotifications() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % NOTIFS.length), 3000);
    return () => clearInterval(t);
  }, []);

  const n = NOTIFS[i];

  return (
    <div className="mx-auto w-full max-w-xs animate-float-soft">
      <div className="rounded-3xl bg-white/95 p-4 shadow-2xl ring-1 ring-black/5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoMark />
            <span className="text-xs font-semibold text-neutral-500">QuickFix Auto · now</span>
          </div>
          <span className="rounded-full bg-neutral-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            {n.tag}
          </span>
        </div>

        {/* keyed wrapper re-mounts on change to replay the enter animation */}
        <div key={i} className="animate-notif-in">
          <p className="mt-3 text-base font-bold text-neutral-900">{n.title}</p>
          <p className="text-sm text-neutral-600">{n.body}</p>
          <div className="mt-4 h-px bg-neutral-100" />
          <p className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
            <span className={`inline-block h-2 w-2 rounded-full ${n.dot}`} />
            {n.foot}
          </p>
        </div>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
          {NOTIFS.map((_, k) => (
            <span
              key={k}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                k === i ? "w-5 bg-brand" : "w-1.5 bg-neutral-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
