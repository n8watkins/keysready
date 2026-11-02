# Two-Way Notification Engine

A self-contained, multi-channel notification engine for the auto-shop booking
system. It sends booking-status updates to customers over **SMS** and to staff
over **Web Push**, handles **inbound** SMS (STOP/HELP/START), enforces
**consent** and **quiet hours**, and is built so the queue/worker can be swapped
for BullMQ/Redis or Cloudflare Queues with no change to the delivery logic.

The whole thing runs as a **pure-Node demo with zero `npm install`** — the real
providers (Twilio, web-push) and the Express webhook router are **lazy-loaded**,
so the engine file imports fine even when those packages are absent.

---

## Run the demo (no install, no credentials)

```bash
node sms-engine/demo.js
```

The demo:

1. Opts a customer in via the booking form.
2. Walks a booking through `PENDING → CONFIRMED → IN_PROGRESS → READY →
   COMPLETED`, sending one SMS per transition.
3. Forces one update into **quiet hours** so it is **DEFERRED** to the next 8am.
4. Simulates an inbound **`STOP`** → records opt-out, auto-replies, then a later
   send is **BLOCKED**.
5. Simulates **`START`** → re-subscribe, then a send **succeeds** again.
6. Prints a full transcript (sent / deferred / blocked / auto-reply) + summary.

Everything uses the `SimulationProvider`, a fake carrier + fake push service
that records messages in memory and can synthesize inbound replies.

---

## How it works

```
                       notifyBookingStatusChange()
                                  │
                                  ▼
   ┌──────────────┐        ┌─────────────┐        ┌──────────────────────┐
   │ ConsentStore │◀──────▶│  Dispatcher │───────▶│  ProviderRegistry    │
   │ opt-in/out   │        │  queue +    │        │  'sms'   -> provider │
   │ keyword class│        │  worker loop│        │ 'webpush'-> provider │
   └──────────────┘        └─────────────┘        └──────────────────────┘
          ▲                       │                          │
          │                       │ render(status, vars)     ▼
   inbound webhooks         ┌───────────┐            send(message)
   /push subscribe          │ templates │      ┌──────────────┬───────────┐
                            └───────────┘      │ Simulation   │ Twilio /  │
                                               │ (demo/tests) │ Web Push  │
                                               └──────────────┴───────────┘
```

Per job, the **Dispatcher worker** runs:

1. **Consent gate** — block SMS to anyone not opted in (auto-replies and
   bypass-flagged staff push are exempt).
2. **Quiet hours** — if outside the allowed local window, **defer** to
   `nextSendableTime` (the next 8am). STOP/HELP auto-replies are exempt.
3. **Render** — `templates.render(status, vars)` interpolates
   `{{firstName}} {{ref}} {{vehicle}} {{etaDate}}`.
4. **Send** — via the channel's provider, selected from the registry.
5. **Retry** — transient failures re-enqueue with exponential backoff.
6. **Log** — every outcome appends to an in-memory Message log.

### Channel strategy

| Audience  | Channel   | Why                                                        |
|-----------|-----------|------------------------------------------------------------|
| Customers | **SMS**   | Highest open rate; no app install; works on any phone.     |
| Staff     | **Web Push** | Desktop/PWA alerts for new bookings & replies; free; no per-message cost. |

Because both channels sit behind the single `NotificationProvider` interface
(`send` / `name` / `supportsChannel`) and a `ProviderRegistry`, they are
interchangeable — the Dispatcher never talks to Twilio or web-push directly.

### Compliance built in

- **Consent**: opt-in required before any customer SMS; full audit trail of
  `{ source, useCase, capturedAt, text }`.
- **Keywords**: `STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT/REVOKE` → opt-out;
  `HELP/INFO` → help reply; `START/UNSTOP` → re-subscribe. STOP and HELP are
  always auto-acknowledged (carrier requirement).
- **Quiet hours**: default 8:00–21:00 in the recipient's local timezone
  (configurable). Texas preset is 9:00–21:00 (`quietHours.PRESETS.TX`).
- **No URL shorteners** in templates (carriers flag them as spam).

---

## Files

| File | Purpose |
|------|---------|
| `provider.js` | `NotificationProvider` interface + `ProviderRegistry`. |
| `providers/simulation.js` | Zero-dep fake carrier + push service (demo/tests). |
| `providers/twilioSms.js` | Real Twilio SMS (lazy `require('twilio')`) + `verifyTwilioSignature`. |
| `providers/webPush.js` | Real Web Push (lazy `require('web-push')`). |
| `consent.js` | `ConsentStore` + keyword classification. |
| `quietHours.js` | `isWithinQuietHours` / `nextSendableTime` (Intl tz math, no deps). |
| `templates.js` | Per-status copy + `render(status, vars)`. |
| `dispatcher.js` | Queue + async worker (consent → quiet hours → render → send → retry → log). |
| `webhooks.js` | Express router: Twilio inbound/status + push subscribe/test. |
| `engine.js` | Composition root + `createNotificationEngine()` + `notifyBookingStatusChange()`. |
| `demo.js` | Runnable pure-Node demonstration. |

---

## npm dependencies

- **Demo / simulation path:** **none.** Pure Node built-ins (`http`, `crypto`,
  `timers`, `Intl`). No install required.
- **Real providers (only when actually used):**
  - SMS → **`twilio`** (`npm i twilio`).
  - Web Push → **`web-push`** (`npm i web-push`).
  - Webhook router → **`express`**.

These are imported **lazily** inside the provider/webhook code paths, so the
engine and demo load even when they are not installed.

> The engine is not wired into `web/` yet and has no `package.json` of its own;
> add these dependencies wherever you integrate it.

## Environment variables

See `.env.example`. Summary:

```
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
TWILIO_MESSAGING_SERVICE_SID  (preferred)  or  TWILIO_FROM_NUMBER
TWILIO_STATUS_CALLBACK_URL    (optional, per-message delivery callbacks)
VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
QUIET_HOURS_START, QUIET_HOURS_END, QUIET_HOURS_TZ
```

If Twilio creds are absent, the engine auto-selects the `SimulationProvider`
for SMS; likewise web-push falls back to simulation without VAPID keys. So the
same code runs in dev (simulated) and prod (real) with no branching.

### Wiring into the Express app (production)

```js
const { createNotificationEngine } = require('./notifications/engine');
const engine = createNotificationEngine();           // reads process.env
app.use(engine.router());                             // mounts webhook routes

// on a booking status change:
engine.notifyBookingStatusChange({ shopId, customer, booking, status });
```

---

## How this maps to Cloudflare

The engine was designed so the in-memory pieces are thin shims over Cloudflare
primitives. Migration is mechanical:

| Engine piece (here) | Cloudflare equivalent |
|---------------------|-----------------------|
| **Dispatcher queue** (`enqueue` + in-memory array) | **Cloudflare Queues** — `enqueue(job)` becomes `env.QUEUE.send(job)`; the worker loop becomes the `queue(batch, env)` consumer handler. The `_handleJob` method (steps 1–6) lifts over verbatim — it has no in-memory-queue assumptions. |
| **Quiet-hours deferral** (`notBefore` + re-enqueue) | **Durable Object Alarms** (or **Cron Triggers**) — store the job in the DO and set `state.storage.setAlarm(nextSendableTime)`; the `alarm()` handler re-attempts the send. Queues' `delaySeconds` covers short defers; DO alarms cover "park until 8am tomorrow." |
| **Webhook router** (`webhooks.js`) | **Workers** — the Twilio inbound/status and push routes become a `fetch` handler (or Hono routes) on a Worker; `verifyTwilioSignature` runs at the edge before processing. |
| **ConsentStore / Message log** (in-memory `Map`/array) | **D1** (SQL) or **Durable Object storage** / **KV** — consent + audit trail in D1; per-conversation thread + message log in a per-customer Durable Object. |
| **Provider registry** | Unchanged — providers call Twilio's REST API and the Web Push protocol over `fetch`, both Workers-compatible. |

Retry/backoff maps to Queues' built-in `retry()` / `max_retries` or to DO
alarm rescheduling. Idempotency keys (the job id) prevent duplicate sends on
re-delivery.
