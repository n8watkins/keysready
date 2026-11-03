# KeysReady — Next.js app (the product)

A working, mobile-first **PWA** for auto shops: customers book a repair and get a
**Web Push** notification at every status change; staff get pushed the moment a
booking lands. Shops can message customers and send estimates that customers approve
and pay with Stripe Checkout. **No Google, no Firebase, no app store.**

## Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) + React 19 + TypeScript |
| Styling | Tailwind v4 |
| Backend | Next.js **route handlers** (`app/api/*`) — no separate server |
| Notifications | **Web Push** (`web-push` + VAPID) now · SMS later behind the same layer |
| Data | **Turso / libSQL** (relational SQLite — not Postgres, not Google). Local: a SQLite file, zero setup. Prod: Turso cloud |
| Hosting | **Cloudflare Workers** (OpenNext) |
| Auth | Shop staff: email + password (scrypt, HMAC session cookie). Drivers: email magic links (Brevo or Resend). Better Auth is mounted at `/api/account/*` as the next auth foundation |
| Payments | Stripe Checkout + signed webhook (simulated when `STRIPE_SECRET_KEY` is unset) |

## Run it

```bash
npm install
npx web-push generate-vapid-keys     # if you don't already have .env.local
# put the keys in .env.local (see .env.example): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
# VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY
npm run dev                          # http://localhost:2323
```

`SESSION_SECRET` is required (the app refuses to start without it). To get a shop login
locally, set `SEED_DEMO_STAFF=true` and a strong `DEMO_STAFF_PASSWORD` (12+ characters)
in `.env.local`; there is no default password, and published defaults are rejected.

### End-to-end tests

```bash
npm run build
npm run e2e:account   # /account sign-up, sign-in and restart on a fresh database
npm run e2e           # driver to shop to quote to payment
```

Both scripts start `next start` on a brand-new throwaway SQLite file for every run, whatever `.env.local` says, so they never touch a real database.
`scripts/e2e-account.sh` needs nothing else and runs in CI.
`scripts/e2e.sh` drives the full driver to shop to quote to payment flow, including Stripe webhook signature checks; it needs the demo owner settings above plus Stripe test keys in `.env.local`.
To run it against another throwaway database on purpose, set `E2E_DATABASE_URL` (and `E2E_DATABASE_AUTH_TOKEN`).

### Database

Locally the app writes to a SQLite file at `.data/app.db` (gitignored) and seeds demo data on first run; no setup needed.
Every table, including Better Auth's `user`, `session`, `account` and `verification`, is created on first use and the setup is safe to re-run: it only creates what is missing and never drops or rewrites anything.

`npm run dev` uses the local file.
If `DATABASE_URL` in `.env.local` points at a remote (Turso) database, `next dev` ignores it and logs a warning, so a dev session can't write to production by accident.
To develop against a remote database on purpose, use a throwaway one and set `ALLOW_REMOTE_DATABASE=true` as well.

### Ports & worktrees

This app runs on **port 2323** (`next dev -p 2323` / `next start -p 2323`). When you
check out additional **git worktrees**, give each the next port up — **2324, 2325, …**
(one per worktree) — so they can all run side by side.

Then: open `/dashboard` on your phone (or two browsers), tap **Enable booking
alerts**, book a repair at `/book` in another tab, and change the status on the
dashboard — the customer/staff get a push. On iPhone, **Add to Home Screen first**
(iOS only delivers web push to installed PWAs).

## Structure

```
app/
  (marketing)/        # SSG, SEO — sells to shops
    page.tsx          #   /         landing
    pricing/page.tsx  #   /pricing
  (app)/              # the product UI
    book/             #   /book      customer booking + opt-in to push
    status/           #   /status    customer ref+phone lookup + opt-in
    dashboard/        #   /dashboard staff: change status (-> pushes customer), enable alerts
  api/
    bookings/         #   POST create (+push staff) · GET list
    bookings/[ref]/   #   GET lookup (phone-gated) · PATCH status (+push customer)
    push/subscribe/   #   store a push subscription
    push/vapid-public-key/
    health/
lib/        types · store · push (web-push) · notifications · templates · client-push
components/ RegisterSW · PushButton · StatusBadge
public/     manifest.webmanifest · sw.js · icons/
```

## Production notes

- Data persists via **Turso/libSQL** (verified across restarts locally). For prod,
  create a free Turso DB and set `DATABASE_URL` + `DATABASE_AUTH_TOKEN` (see `.env.example`);
  the same `@libsql/client` code runs locally and on Turso cloud. No Postgres, no Google.
- `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` are plain variables in `wrangler.jsonc`, `VAPID_PRIVATE_KEY` is a Worker secret; the browser fetches the public key from `/api/push/vapid-public-key`.
- SMS is a later paid channel; the full two-way Twilio engine lives in
  [`../sms-engine`](../sms-engine) and plugs in behind `lib/notifications.ts`.

## Deploy

The app runs as a Cloudflare Worker built with OpenNext (`@opennextjs/cloudflare`); `wrangler.jsonc` and `open-next.config.ts` hold the config.
It is served at https://keysready.nathancwatkins23.workers.dev, and https://keysready.vercel.app keeps serving the old Vercel deployment until the domain moves.

```bash
npm run deploy    # from web/: OpenNext build, then wrangler deploy
npm run preview   # the built Worker locally on workerd (secrets from .dev.vars)
```

- **Secrets** are set with `npx wrangler secret put <NAME>`, never in a file: `SESSION_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `VAPID_PRIVATE_KEY`, `DEMO_STAFF_EMAIL`, `DEMO_STAFF_PASSWORD`, `EMAIL_FROM`, `BREVO_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
  `APP_URL`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` and `SEED_DEMO_STAFF` are plain variables in `wrangler.jsonc`.
- **From GitHub:** `.github/workflows/deploy.yml` builds on every push to main that touches `web/`, and deploys once the repository has a `CLOUDFLARE_API_TOKEN` secret (an API token with the "Edit Cloudflare Workers" permission); until then it skips the deploy with a notice.
- **Against the deployed Worker:** `scripts/e2e.sh` runs there too, with `E2E_BASE_URL` and `E2E_LOG` (see the script's header); give the Worker a throwaway database first, never the production one.
- **Stripe** webhooks are sent to whichever host the Stripe dashboard names; add `<host>/api/webhooks/stripe` there when the domain moves.

