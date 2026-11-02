/**
 * Site-wide settings. The concept page lives at https://keysready.n8builds.dev
 * until KeysReady gets its own domain. NEXT_PUBLIC_SITE_URL can override the canonical
 * URL at build time.
 */
export const site = {
  name: "KeysReady",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://keysready.n8builds.dev").replace(/\/$/, ""),
  title: "KeysReady: booking, live repair status and pay-by-phone for small auto shops",
  description:
    "KeysReady gives small auto shops online booking, live repair status updates and estimates customers approve and pay from their phone, so the \"is my car ready?\" call stops. Free and open source, in development.",
  shortDescription: "Stop answering \"Is my car ready?\" Booking, live status and pay-by-phone for small shops.",
  updated: "2026-11-01",
  /** The waitlist lives on n8builds.dev, where the product is built in public. */
  waitlistUrl: "https://n8builds.dev/upcoming?interest=keysready#keysready",
  builderUrl: "https://n8builds.dev",
} as const;

/** Routes that exist on this site, used by the sitemap and the 404 page. */
export const routes = [
  { path: "/", title: "Home" },
  { path: "/#how-it-works", title: "How it works" },
  { path: "/#features", title: "Features" },
  { path: "/#updates", title: "How customers get updates" },
  { path: "/#open-source", title: "Open source and self-host" },
  { path: "/#compare", title: "Compare with Tekmetric, Shopmonkey and AutoLeap" },
  { path: "/#pricing", title: "Pricing" },
  { path: "/#faq", title: "FAQ" },
  { path: "/privacy", title: "Privacy" },
  { path: "/terms", title: "Terms" },
] as const;
