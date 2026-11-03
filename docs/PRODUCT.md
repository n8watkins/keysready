# KeysReady: Product Definition

Status: concept with a working prototype.
Features marked **Prototype** run today in the single-shop demo at https://app.keysready.n8builds.dev; everything else is planned.
Written 2026-11-01.
Competitor facts come from the [market report](MARKET_REPORT_2026-11.md) (vendor pages checked 2026-11-01).
Carried over from the retired private repository on 2026-11-02; see [HISTORY.md](HISTORY.md).

## 1. Positioning

### One-liner

**KeysReady is the free, open-source customer line for small auto shops: online booking, live repair status, and estimates customers approve and pay from their phone, so the "is my car ready?" call stops.**

Hero: "Stop answering 'Is my car ready?'"
Short form: "Booking, live repair status and pay-by-phone for small shops. Free and open source."

### The shift from the June 2026 pitch

The June pitch was "free Web Push beats paid SMS".
That is the weaker half: incumbents bundle transactional texts, and iPhone web push needs a home-screen install.
The relaunch leads with the outcome (no status calls, faster approvals, paid before pickup) and treats channels as plumbing: email is the free default, push is the free upgrade, SMS is paid.

### Who it is for

| Segment | Pain today | Why KeysReady |
|---|---|---|
| Independent 1 to 3 bay shops with no shop software | Paper tickets, the owner's cell phone, all-day status calls | Free, live in minutes, no sales call, works from a phone |
| Mobile mechanics, tire, glass, detailing and quick-lube shops | Customers wait without knowing when to come back | Same received, in progress, ready flow with a booking link |
| Shops already on shop management whose plan lacks booking or two-way texting | Booking and texting are $249 to $345 add-ons or top-tier features | A cheap customer layer next to what they already run |
| Agencies building sites for local shops | Need booking and status without a $200 subscription per client | Open-source engine they can host and embed |
| Privacy-minded or technical owners | Do not want customer data in someone else's SaaS | Self-host the whole app |

Not for (now): repair orders, labor guides, parts ordering, inventory, digital inspections, payroll, accounting, dealer groups.

### Jobs to be done

1. "Let customers book a repair without calling me."
2. "Tell customers where their car is, so they stop calling to ask."
3. "Get the customer's yes on extra work fast, in writing, without phone tag."
4. "Get paid before the keys leave the counter."
5. "Bring customers back when their car is due."

## 2. Feature list

Status legend: **Prototype** (works in the current single-shop demo), **MVP** (first public release), **Beta** (hosted beta), **Later** (after beta).

### Booking

| Feature | What it does | Status |
|---|---|---|
| Public booking page | Customer picks a service, enters car and contact details, no account needed | Prototype |
| Per-shop booking link | A link like `/s/your-shop`, embeddable on any website | MVP |
| Staff alert on new booking | Push to staff phones the moment a booking lands | Prototype |
| Shop hours and blackout days | Booking only offers open days | MVP |
| Bay-aware time slots | Real slots based on bays and job length | Later |

### Live repair status

| Feature | What it does | Status |
|---|---|---|
| Status board | Staff move a car through Received, In progress, Ready, Picked up in one tap | Prototype |
| Customer status page | Live page per booking, opened by link, no app or account needed | Prototype (lookup by reference and phone) |
| Web Push updates | Notification on every status change, no app store | Prototype |
| Email updates | Same updates by email for customers who do not install | MVP |
| ETA and notes | "Waiting on parts, expected Thursday" on the status page | MVP |
| SMS updates | Text updates with done-for-you carrier registration | Beta (paid) |

### Messages and estimates

| Feature | What it does | Status |
|---|---|---|
| Per-job messages | Two-way chat attached to the booking, with push | Prototype |
| Estimates | Line items in the shop's words, sent to the customer's phone | Prototype |
| Approve or decline | Customer taps yes or no; the shop gets a timestamped record | Prototype |
| Photos on estimates | Show the worn part next to the price | Beta |
| Saved services | A shop's own catalog of common jobs and prices | Beta |

### Payments

| Feature | What it does | Status |
|---|---|---|
| Pay by phone | Stripe Checkout for the approved estimate | Prototype (one platform account) |
| Payouts to the shop's own Stripe account | Stripe Connect Standard; the shop is merchant of record | MVP |
| Receipts | Emailed receipt to customer and shop | MVP |
| Deposits and tips | Collect a deposit up front, optional tip line | Later |

### Retention

| Feature | What it does | Status |
|---|---|---|
| Customer garage | Customers keep their cars and history across visits | Prototype |
| Review request after pickup | One message with the shop's Google review link | Beta |
| Service reminders | "Your oil change is due" by email, push or SMS | Beta |

### Platform

| Feature | What it does | Status |
|---|---|---|
| Installable web app (PWA) | Staff and customers can add it to the home screen | Prototype |
| Self-signup and shop settings | Create a shop, name, logo, hours, services | MVP |
| Staff accounts and roles | Owner invites staff; owner, advisor, tech roles | Beta |
| Data export and delete | CSV export; customer delete-my-data | MVP |
| API and webhooks | Booking and status events for agencies and integrations | Later |
| Shop management integrations | Read-only status sync from Tekmetric or Shopmonkey where their APIs allow | Later |

## 3. Self-host vs hosted

KeysReady is open source first, adjusted to its audience: most shop owners will use the hosted version, and self-hosting serves agencies, developers and privacy-minded shops.

| | Self-host | Hosted |
|---|---|---|
| Code | Same repository, MIT license | Same code, run by us |
| Runs on | Any Node host or Cloudflare, plus a libSQL or SQLite database | Our infrastructure |
| Email and push | Bring your own Brevo, Resend or SMTP key; push needs only VAPID keys | Included |
| SMS | Bring your own Twilio or Telnyx account and registration | Paid plan, registration done for you |
| Payments | Your own Stripe account | Stripe Connect, payouts straight to the shop |
| Support | Community | Email support on paid plans |
| Data | Stays on your infrastructure | Stored by us, export and delete any time |

The self-host release ships before the hosted beta, so the open-source promise is real from day one.

## 4. Pricing (planned, early access)

Nothing is billable today.

| Plan | Price | What you get |
|---|---|---|
| Self-host | $0 forever | Everything in the open-source app on your own infrastructure; bring your own email, SMS and Stripe keys |
| Free (hosted) | $0 | One shop, one staff seat, unlimited bookings and status pages, unlimited email and push updates, messages, estimates and pay by phone |
| Pro (hosted) | $29/mo per shop | Everything in Free, plus SMS updates (about 500 texts a month), review requests, service reminders, up to five staff, your branding only |

Card payments run at Stripe's standard rates on every plan; KeysReady adds no fee during the beta.
Multi-location pricing is not planned until a multi-location shop asks.

### Reasoning

- The free plan has to be a real product, because the target shop pays for nothing today; email and push cost almost nothing to send, so it is sustainable.
- $29 sits far below the cheapest auto-aware incumbent ($179 to $279) and below the $249 to $345 booking add-ons, while covering SMS costs of roughly $6 to $9 a month per shop (June 2026 estimate).
- An earlier draft had three paid tiers before there was one paying customer; one paid plan is easier to explain and to change.
- A payments platform fee is a long-term revenue idea; it waits until shops trust the product, and is announced before it applies.

## 5. Comparison

| | KeysReady (planned) | Tekmetric | Shopmonkey | AutoLeap |
|---|---|---|---|---|
| Starting price | $0 (Pro $29/mo) | $199/mo | $239/mo | $199/mo |
| Free plan | Yes | No | No | No |
| Open source and self-host | Yes | No | No | No |
| Online booking at entry tier | Yes | Add-on ($345/mo Marketing) | Appointments and reminders; self-booking not described | Add-on (Marketing Suite) |
| Two-way messages at entry tier | Yes | Scale plan ($439) | Yes | Pro plan ($349) |
| Estimate approval and pay by phone | Yes | Yes | Yes | Yes |
| Repair orders, labor guides, parts, inventory | No | Yes | Yes | Yes |
| Digital vehicle inspections | No | Yes | Yes | Yes |

Sources: vendor pricing pages checked 2026-11-01.
KeysReady does not compete on shop management; the comparison is about the customer-facing layer.

### Briefly, the others

- **Shop-Ware** ($279 to $999): online scheduler only in Ultimate+ or a $249 add-on.
- **Shop Boss** ($199 to $649): online booking only in Premier Plus or a $249 add-on.
- **Mitchell 1 Manager SE**: quote-only, desktop roots.
- **Garage360** ($99 to $249, unverified): cheapest shop management; no free plan.
- **Podium, Kukui, Kenect, Steer**: messaging and marketing suites from roughly $189 to $699 a month, mostly quote-only.
- **AI receptionists** ($99 to $109 a month): answer the status call; KeysReady prevents it.

## 6. Name

**KeysReady** stays: it says the outcome ("your keys are ready") and is already the repo, app and deploy name.

Until a product domain is chosen, the concept lives at https://keysready.n8builds.dev.

## 7. Principles

1. **Honest copy.**
   No invented numbers, testimonials, ratings or logos; planned features and prices are labelled as planned.
2. **The customer never needs an app.**
   Every update works from a link and an email; push and SMS are upgrades.
3. **The shop owns its customers.**
   Export everything, delete on request, self-host if you want.
4. **Free means useful.**
   The free plan runs a real shop's front desk, not a trial.
5. **Next to, not instead of.**
   KeysReady works beside paper, spreadsheets or a shop management system.
6. **Open source first.**
   The self-host release comes before the hosted beta.

License: MIT, see [LICENSE](../LICENSE).
