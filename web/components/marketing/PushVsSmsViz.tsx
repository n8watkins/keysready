"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Reveals once in view; also reports whether the visitor prefers reduced motion. */
function useReveal(threshold = 0.25) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      const id = requestAnimationFrame(() => setReduced(true));
      return () => cancelAnimationFrame(id);
    }
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      const id = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      // One callback can carry several entries for the element: a scroll before
      // the first delivery gives "out of view" and then "in view" together, so
      // reading only the first left the chart unrevealed after a quick jump.
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView, reduced };
}

/** Eased count-up. Defaults to the final value (correct for SSR / no-JS / reduced motion). */
function Count({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
  run,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  run: boolean;
}) {
  const [v, setV] = useState(to);
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const start = performance.now();
    const dur = 1300;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(p < 1 ? to * eased : to);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, to]);
  return (
    <>
      {prefix}
      {v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

const BARS = [
  { label: "KeysReady — free plan", display: "$0", pct: 2, color: "bg-brand" },
  { label: "Typical SMS shop platform", display: "$200–300/mo", pct: 100, color: "bg-neutral-500" },
];

const NEVER = [
  "A monthly platform fee just to send a status update",
  "Per-message carrier fees (~1.3¢ on every text)",
  "A2P 10DLC registration ($4–$44 + $15 + $2–10/mo)",
  "Per-seat or per-message metering",
];

export default function PushVsSmsViz() {
  const { ref, inView, reduced } = useReveal(0.25);
  const animate = inView && !reduced;
  const filled = inView || reduced;

  const stats: { big: ReactNode; label: string }[] = [
    { big: <Count to={10000} suffix="+" run={animate} />, label: "push notifications you can send this month for $0" },
    { big: <Count to={0.0125} prefix="$" decimals={4} run={animate} />, label: "what each text costs on a metered SMS plan" },
    { big: <Count to={300} prefix="$" run={animate} />, label: "/yr in carrier fees for 2,000 status texts a month" },
  ];

  return (
    <div ref={ref}>
      {/* animated stat row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{s.big}</p>
            <p className="mt-2 text-sm text-neutral-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* monthly-cost bar chart (subscription, before any messages) */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm font-semibold text-neutral-300">
          Monthly platform fee — before a single message is sent
        </p>
        <div className="mt-5 space-y-4">
          {BARS.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-neutral-300">{b.label}</span>
                <span className="font-bold text-white">{b.display}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${b.color}`}
                  style={{
                    width: filled ? `${b.pct}%` : "0%",
                    transition: reduced ? "none" : "width 1.1s cubic-bezier(0.2,0.7,0.2,1)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Most shop tools start at $200–300/mo and meter texts on top. The free plan has
          neither — push is unlimited at $0.
        </p>
      </div>

      {/* what you never pay for + the "texting is overrated" thesis */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <p className="font-bold text-white">What you never pay for</p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-300">
            {NEVER.map((n) => (
              <li key={n} className="flex items-start gap-2">
                <span className="mt-0.5 font-bold text-brand-light">✓</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6">
          <p className="font-bold text-white">Texting is overrated.</p>
          <p className="mt-2 text-sm text-neutral-200">
            It’s a workaround for not knowing who your customer is. Once they’ve booked
            with you, you already have a free, direct line — instant, two-way, with
            photos. No phone number, no carrier, no meter in the middle.
          </p>
          <p className="mt-3 text-xs text-neutral-400">
            The one catch: push needs the customer to opt in once — on iPhone, that’s Add
            to Home Screen first. The ones who don’t are exactly who the paid SMS tier
            covers.
          </p>
        </div>
      </div>
    </div>
  );
}
