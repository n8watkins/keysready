"use client";

import { useEffect, useState } from "react";
import { getPushSupport, subscribeToPush } from "@/lib/client-push";
import type { SubscriberRole } from "@/lib/types";

interface Props {
  role: SubscriberRole;
  bookingRef?: string;
  /** Customer subscriptions must prove booking ownership with the booking's phone. */
  phone?: string;
  label?: string;
  className?: string;
}

type State = "checking" | "ready" | "working" | "done" | "error" | "unsupported";

export default function PushButton({ role, bookingRef, phone, label, className }: Props) {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const s = getPushSupport();
    if (s.supported) {
      setState("ready");
    } else {
      setState("unsupported");
      setMessage(s.reason || "Notifications aren't supported on this device.");
    }
  }, []);

  async function handleClick() {
    setState("working");
    setMessage("");
    const res = await subscribeToPush(role, bookingRef, phone);
    if (res.ok) {
      setState("done");
      setMessage(
        role === "staff"
          ? "You'll get a push the moment a booking comes in."
          : "You'll get a push when your car's status changes.",
      );
    } else {
      setState("error");
      setMessage(res.error || "Couldn't enable notifications.");
    }
  }

  const base =
    "w-full min-h-[48px] rounded-xl px-5 py-3 text-base font-semibold transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

  if (state === "unsupported") {
    return (
      <div className={className}>
        <button disabled className={`${base} cursor-not-allowed bg-neutral-100 text-neutral-400`}>
          <span aria-hidden="true">🔔</span> Notifications unavailable
        </button>
        <p className="mt-2 text-sm text-neutral-500" aria-live="polite">{message}</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className={className}>
        <button disabled className={`${base} bg-green-600 text-white`}>
          <span aria-hidden="true">✅</span> Notifications on
        </button>
        <p className="mt-2 text-sm text-neutral-600" aria-live="polite">{message}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        onClick={handleClick}
        disabled={state === "working" || state === "checking"}
        className={`${base} bg-brand text-white hover:bg-brand-dark disabled:opacity-60`}
      >
        {state === "working" ? (
          "Enabling…"
        ) : label ? (
          label
        ) : (
          <>
            <span aria-hidden="true">🔔</span> Enable notifications
          </>
        )}
      </button>
      {state === "error" && (
        <p className="mt-2 text-sm text-red-600" aria-live="assertive">{message}</p>
      )}
    </div>
  );
}
