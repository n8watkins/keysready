# KeysReady history

This repository started fresh on 2026-11-02.
Everything before that lived in a private repository, `n8watkins/keysready-archive`, which held a 2025 prototype, the 2026 rebuild into the current app, and about twenty planning and review documents.
That repository was deleted on 2026-11-02, after the parts worth keeping were folded into this one.
This page records what the old project was, how it became the current app, why the history was not carried over, and what it taught us.
No code was brought over when the archive was retired; the current code already started from the archive's last state.

## Timeline

| Date | What happened |
| --- | --- |
| 2025-05-23 | A one-day prototype, "Auto Repair Shop Booking System": a React client and an Express server for a single repair shop. |
| 2025-05 to 2026-06 | Untouched; the hosted backend stopped responding. |
| 2026-06-20 | Audit and security pass on the prototype, then a full rebuild as a Next.js 16 progressive web app with Web Push and Turso, and the name KeysReady. |
| 2026-06-20 and 21 | Three cumulative versions, each frozen on its own branch and deployed to its own URL: V1 Notify, V2 Track, V3 Transact. |
| 2026-06-27 and 28 | Animated marketing page, a 35-finding code review, the three fix-first security fixes, a Better Auth foundation and magic-link email through Brevo. |
| 2026-11-01 and 02 | Fresh assessment, market report and repositioning, a separate static landing page, the Next.js 16.4.3 security update, and a fix that stops the demo shop from seeding a published password. |
| 2026-11-02 | This public repository created from a clean snapshot of that code; the old repository renamed to `keysready-archive` and kept private and read-only, then deleted once this page existed. |

## The 2025 prototype

### What it was

A full-stack booking site for one independent auto repair shop, with a customer side and a staff side.
It was built in a single day as a demo of what a small shop's website could do, not as a product for many shops.
Its audience was the shop's customers (book a repair, track it) and the shop's staff (manage bookings and update status).

### Stack

- Client: React 18, Vite, TypeScript, Tailwind CSS, React Router, react-query, with a Netlify deploy config.
- Server: Node.js 20, Express 4 REST API, Prisma ORM on SQLite (PostgreSQL planned for production), deployed to Render.
- Auth: Firebase Authentication with Google sign-in for customers, Firebase Admin on the server, and a separate staff login.
- Payments and SMS: Stripe and Twilio packages were installed, but neither sent anything real.

### Features

- Customer side: a landing page, Google sign-in, "My Garage" to save cars, a step-by-step booking flow (pick a car, describe the issue, pick a date, contact details, payment, confirm), a confirmation page, repair history, and a repair status lookup.
- Staff side: a dashboard, a bookings list and booking detail with status updates, a vehicles list, an analytics page and settings.
- Data model: `User`, `Car` and `Booking` (reference number, status, ETA, amount, contact details, SMS opt-in).

### What was real and what was not

The prototype looked finished, but every hard integration was faked.

| Capability | What the demo showed | What existed |
| --- | --- | --- |
| SMS to customers | "Text sent" | A mock that only logged |
| Payments | A payment step | Stripe packages, no working charge |
| Persistence | A running app | Mock data in the client whenever the backend failed, and a hosted backend that later went dead |
| Auth | Logins that worked | A hardcoded staff login and a static bypass token (see the security lessons) |
| Booking errors | "Booking confirmed" | The client fabricated a success when the server failed |

## From the prototype to the current app

The June 2026 audit concluded that the prototype could not be shared even as a demo: the backend was gone, the honest error handling broke the booking flow, and the staff screens did not work on a phone.
Instead of patching it, the project was rebuilt with these decisions:

- One Next.js 16 App Router app, with route handlers as the backend, instead of a separate client and server.
- No Google or Firebase anywhere: Web Push with VAPID keys for notifications, and Turso (libSQL) for data, which runs the same code against a local SQLite file.
- Web Push as the free notification channel and SMS as a later paid channel, behind one notification interface.
- An installable PWA, mobile first, with the marketing pages separated from the staff dashboard.
- Every table scoped by `shop_id` from the start, even with one demo shop.

The old `client/` and `server/` code was deleted, and the two-way SMS engine written during the audit was kept as the standalone [`sms-engine/`](../sms-engine/).
The product was renamed KeysReady, with "QuickFix Auto" kept as the demo shop.
It then grew in three cumulative versions:

1. **V1 Notify**: booking, live status with push at every change, a staff status board, and customer accounts by email magic link with a garage and repair history.
2. **V2 Track**: a two-way message thread per booking, with a push on every new message.
3. **V3 Transact**: estimates built from line items, customer approval, payment through Stripe Checkout, a signed Stripe webhook, and an end-to-end test of the whole flow.

Each version was deployed from its own frozen branch to its own Vercel address; those addresses no longer resolve.
All three are contained in the current code, including the magic-link rate limit that was the only change unique to the V1 and V2 branches.

In November 2026 a fresh assessment found the code sound for one shop but the pitch wrong (see the product lessons below), which led to the repositioning in [PRODUCT.md](PRODUCT.md) and the static landing page in [`landing/`](../landing/).

## Why the repository was restarted

The old history contained live-looking secrets and other sensitive leftovers from the 2025 prototype (listed below).
Rewriting that history in place would have meant force-pushing over every branch, and the old docs also held internal notes that did not belong in a public project.
So the current code was scanned and published as a new public repository with one clean starting commit, and the old one stayed private and read-only until its knowledge was captured here.

## Security lessons

Every credential that appeared in the old git history has been rotated, retired or is dead; none of them works against anything today.
The five service keys pasted into chat were never in the repository, only their names; their rotation is still pending.

| What happened | Why it mattered | Where it stands now |
| --- | --- | --- |
| A real JWT signing secret was committed in the server's example env file, and the server fell back to a fixed default secret when none was set. | Anyone with the repository could sign valid session tokens. | The Express server is gone and the secret is dead. The app refuses to start without `SESSION_SECRET` ([`web/lib/auth.ts`](../web/lib/auth.ts)). |
| The Firebase web config for the prototype's project was hardcoded in the client. | It shipped in every bundle and in git history, tied to a Google project nobody maintained. | The key no longer works and the app has no Firebase code. Deleting the old project is item 3 of [OWNER-TODO.md](../OWNER-TODO.md). |
| A hardcoded staff username and password, with the credentials shown on the login screen, plus admin rights granted to any email containing "admin". | A guaranteed way in for anyone who looked. | Retired. Staff passwords are scrypt hashes; demo staff exist only when explicitly enabled. |
| A static test token bypassed authentication, and `Authorization` headers were written to the logs. | A full auth bypass in any environment, and live tokens readable by anyone with log access. | Removed in the June 2026 security pass, before the rebuild. |
| Demo staff credentials were seeded by default: V1 to V3 seeded the demo owner with a documented default password, and the seed kept whatever an older build had stored. | Anyone who read the docs could sign in to the public demo as the shop owner. | Rotated. The seed runs only with `SEED_DEMO_STAFF=true`, rejects published defaults and short passwords, and disables a stored default on boot ([`web/lib/db.ts`](../web/lib/db.ts)). |
| The development SQLite database and a temporary env file were committed. | Real test data and settings in history, and the next one would have followed. | `.gitignore` ignores every `.env*` except examples and every `*.db`. |
| Local development and the end-to-end script pointed at the production Turso database. | Every local run and test wrote bookings, messages and payment events into production. | `next dev` ignores a remote database unless `ALLOW_REMOTE_DATABASE=true` ([`web/lib/db-config.ts`](../web/lib/db-config.ts)), and the e2e scripts use a throwaway local file unless told otherwise. |
| Five service keys were pasted into an agent chat. | Chat logs keep them, so they count as exposed even though they were test or scoped keys. | Rotation is item 1 of [OWNER-TODO.md](../OWNER-TODO.md). |
| Magic links were built from the request's `X-Forwarded-Host` header. | A forged header could send a sign-in link that points at an attacker's site. | Links use a trusted `APP_URL` ([`web/lib/app-url.ts`](../web/lib/app-url.ts)). |
| The Stripe webhook recorded an event as processed before marking the booking paid. | A brief database error would drop a real payment for good. | The event is recorded only after `markPaid` succeeds ([`web/app/api/webhooks/stripe/route.ts`](../web/app/api/webhooks/stripe/route.ts)). |

The rules that came out of it:

- Secrets never go in example files, docs or chat; they live in a secret store and in the host's environment, and [`web/.env.example`](../web/.env.example) names them without values.
- Fail closed: no default secrets, no bypass tokens, no demo accounts unless a flag asks for them.
- Removing a secret from the working tree does not remove it from history; rotate first, then decide what to do about the history.
- Development and tests never touch production data by default.
- Scan the full history before any repository becomes public.

## Product and business lessons

- **A demo is not a product.**
  Mocked integrations give most of the visible result for a small part of the work, and the skipped part is the real engineering.
  Only milestones where money, messages or sign-in cross a real network boundary count as progress.
- **Never fake success.**
  A booking that failed must say so; a fabricated confirmation lies to the customer at the exact moment the product fails.
- **The domain model held up.**
  Shop, customer, vehicle and booking, with a clear lifecycle (booked, confirmed, in progress, ready, completed), survived every rewrite, and so did checking status by reference number plus phone number with no account.
- **Free push is the weaker half of the pitch.**
  iPhone web push only works after the customer adds the site to the Home Screen, opt-in rates for web push are low, and incumbents already bundle transactional texts.
  Lead with the outcome ("stop answering 'is my car ready?'"), use email as the free channel that reaches everyone, push as the free upgrade, and SMS as the paid one.
- **Do not build a shop management system.**
  Repair orders, labor guides, parts and inspections are a crowded, expensive category.
  The opening is the customer-facing layer (booking, status, estimate approval, payment), which incumbents put in top tiers or paid add-ons, and the many small shops that use no software at all.
  The [market report](MARKET_REPORT_2026-11.md) has the competitor detail.
- **Keep pricing simple until someone pays.**
  A free plan that runs a real front desk, and one paid plan, beat a ladder of tiers designed before the first customer.
- **Honest marketing copy.**
  The June landing page showed unsourced numbers, an overstated push-versus-SMS chart and paid plans that could not be bought.
  The current landing labels everything planned as planned and invents no figures.
- **Mobile first, for real.**
  Shop owners work from a phone in the bay and customers book from a phone; the prototype's desktop tables and tiny buttons failed both.
- **Separate the marketing site from the app.**
  Different audiences, and marketing changes should not redeploy the product.
- **SMS is a compliance product.**
  Real texting means A2P 10DLC registration, TCPA quiet hours, STOP and HELP handling and consent records, with per-message liability for mistakes.
  If SMS ships, carrying that burden for the shop is the paid value.
- **The concept travels, selectively.**
  A June study of other "is it ready?" businesses found the best fits are frequent, local pickups where customers come back: dry cleaning, pet grooming and phone or computer repair.
  One-time emergencies (locksmiths, plumbers) and takeout restaurants fit worst.
- **Validate before building more.**
  The plan is a hosted pilot with 5 to 10 real shops, measuring how many customers each update reaches and whether status calls drop.

## Plans carried forward

These come from the archive's gap analysis, delivery plan, multi-tenant plan and SaaS roadmap, and are still the intended order.
[PRODUCT.md](PRODUCT.md) has the feature list and planned pricing.

1. **Hardening.**
   Rotate the exposed keys and finish the open June code review findings: login rate limiting and its timing check, atomic estimate writes, duplicate push subscriptions, security headers and CSRF posture, unauthenticated push test endpoints, and the two high findings in `sms-engine/` (opt-out keyed to the wrong shop, and a dispatcher that stops on one bad timezone).
   These were not all re-checked one by one when the archive was retired.
2. **Multi-tenant MVP.**
   Move staff sign-in onto Better Auth with organizations, add shop signup and settings, give each shop a booking link such as `/s/<slug>/book` and remove the hardcoded `DEMO_SHOP_ID`, send status updates by email, move payments to Stripe Connect so each shop is its own merchant, and add data export and delete.
3. **Self-host release.**
   A self-host guide, an env reference and a VAPID key script.
4. **Hosted pilot**
   with 5 to 10 shops, with error tracking, uptime checks and database backups.
5. **Pro plan**
   only after the pilot: SMS through the fixed `sms-engine/`, review requests, service reminders and staff roles.

Decision gate after the pilot: go if most pilot shops use it weekly and some would pay for SMS and reminders; narrow to booking and status if that is all they use; park and leave the code open source if fewer than half use it weekly.
Moving hosting to Cloudflare Workers was considered for the multi-tenant product and stays optional; Vercel works today.

## What was not brought over

| Archive content | What happened to it |
| --- | --- |
| The 2025 prototype code (`client/`, `server/`) | Not copied; it was deleted from the archive's own trunk in June 2026 and is superseded by `web/`. Described above. |
| Branches `v1`, `v2`, `v3` and `salvage/security-and-prototype` | Their code is in this repository: the archive trunk's code, without its docs, became the first commit here. |
| Dependabot branches and open dependency pull requests | Dropped; this repository has its own Dependabot setup. |
| Product definition and November 2026 market report | Brought over, edited for a public repository: [PRODUCT.md](PRODUCT.md) and [MARKET_REPORT_2026-11.md](MARKET_REPORT_2026-11.md). |
| Handoff, status, roadmap, architecture, audit, security, code review and landing review notes | Summarized on this page; the details described code that no longer exists or has since changed. |
| Business model, product decisions, vision, concept expansion, SaaS next steps, multi-tenant plan, gap analysis, delivery plan, public docs outline, takeaways | Summarized in the lessons and plans above. |
| Extra landing page screenshots (dark mode, full page, privacy page, 404) | Not kept; they can be retaken from [`landing/`](../landing/). The two in [`docs/screenshots/`](screenshots/) are current. |

## Where things live now

| Topic | Location |
| --- | --- |
| How to run the app, the demo login and the e2e tests | [`web/README.md`](../web/README.md) |
| Every environment variable | [`web/.env.example`](../web/.env.example) |
| Data access and schema | [`web/lib/store.ts`](../web/lib/store.ts), [`web/lib/db.ts`](../web/lib/db.ts), [`web/lib/db-config.ts`](../web/lib/db-config.ts) |
| Staff and customer sign-in | [`web/lib/auth.ts`](../web/lib/auth.ts), [`web/lib/driver-auth.ts`](../web/lib/driver-auth.ts), [`web/lib/better-auth.ts`](../web/lib/better-auth.ts) |
| Push and email | [`web/lib/push.ts`](../web/lib/push.ts), [`web/lib/notifications.ts`](../web/lib/notifications.ts), [`web/lib/email.ts`](../web/lib/email.ts) |
| Estimates and payments | [`web/lib/payments.ts`](../web/lib/payments.ts), [`web/app/api/webhooks/stripe/route.ts`](../web/app/api/webhooks/stripe/route.ts) |
| SMS engine (not wired in) | [`sms-engine/README.md`](../sms-engine/README.md) |
| Landing page | [`landing/README.md`](../landing/README.md) |
| Positioning, features and planned pricing | [PRODUCT.md](PRODUCT.md) |
| Competitors and market | [MARKET_REPORT_2026-11.md](MARKET_REPORT_2026-11.md) |
| Reporting a vulnerability | [SECURITY.md](../SECURITY.md) |
| Owner tasks (key rotation, old Firebase project) | [OWNER-TODO.md](../OWNER-TODO.md) |
| Releases | [RELEASING.md](../RELEASING.md), [CHANGELOG.md](../CHANGELOG.md) |

## The archive and its backup

`n8watkins/keysready-archive` was deleted from GitHub on 2026-11-02.
Before deletion, every branch and pull request ref was saved to a private git bundle on the owner's machine (`~/archive/keysready-archive-2026-11-02.bundle`), together with an export of its pull requests, and the bundle was test-restored.
The bundle is not published anywhere, because its history still contains the old credentials described above, all of them rotated or dead.
To look at the old history, run `git clone ~/archive/keysready-archive-2026-11-02.bundle keysready-archive` on that machine.
