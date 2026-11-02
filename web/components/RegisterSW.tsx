"use client";

import { useEffect } from "react";

/** Registers the service worker once on the client. Renders nothing. */
export default function RegisterSW() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[sw] registration failed:", err));
  }, []);
  return null;
}
