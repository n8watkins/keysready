# KeysReady landing page

Concept marketing page for KeysReady: booking, live repair status and pay-by-phone for small auto shops.
Next.js 16.4 (App Router, Turbopack), Tailwind CSS 4, no client-side analytics.
Live at https://keysready.n8builds.dev; it moves to its own domain later.
It is a fully static export served by Cloudflare Workers static assets; see `DEPLOY.md`.
It is separate from the product app in `../web/`, so marketing changes never redeploy the product.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # static export to out/
npm run preview        # serve out/ with the Workers runtime
npm run deploy         # build and deploy to keysready.n8builds.dev
npm run lint && npm run typecheck
```

## Environment

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap and robots. Defaults to `https://keysready.n8builds.dev`. |

## Waitlist

There is no form or API on this site.
Every waitlist and early access call to action links to `https://n8builds.dev/upcoming?interest=keysready#keysready` in the same tab.
The URL lives in `lib/site.ts` (`site.waitlistUrl`).

## Content rules

- Copy lives in `lib/content.ts` and must match what the product in `../web/` actually does.
- Every feature carries a status label: Prototype (runs in today's single-shop demo), MVP, Beta or Later; nothing is described as available to shops.
- Pricing is marked as planned.
- No testimonials, shop counts, ratings, saved-call or revenue numbers until they are real and verifiable.
- The hero illustration uses a made-up shop and amounts and says so.
