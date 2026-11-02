"use client";

import { useEffect, useState } from "react";

/**
 * Hero background video that is data- and motion-conscious:
 * - SSR / first paint renders only the poster image (no multi-MB download for LCP).
 * - After hydration it upgrades to the autoplay loop ONLY when the visitor hasn't
 *   asked to reduce motion and isn't on a Save-Data connection.
 */
export default function HeroVideo({ src, poster }: { src: string; poster: string }) {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    if (reduce || conn?.saveData) return;
    const id = requestAnimationFrame(() => setPlay(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const cls = "absolute inset-0 -z-10 h-full w-full object-cover opacity-60";

  if (!play) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt="" aria-hidden="true" className={cls} />;
  }

  return (
    <video className={cls} autoPlay muted loop playsInline preload="metadata" poster={poster}>
      <source src={src} type="video/mp4" />
    </video>
  );
}
