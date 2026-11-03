# KeysReady: Market Report and Relaunch Assessment (November 2026)

Prepared 2026-11-01.
Scope: the KeysReady code as it stood on 2026-11-01, the June 2026 strategy docs, and web research on competitors and the market.
Carried over from the retired private repository on 2026-11-02 and lightly edited; see [HISTORY.md](HISTORY.md).
Prices marked "(vendor page)" were read from the vendor's own pricing page on 2026-11-01.
Everything else is marked "(third-party, unverified)" and comes from listings such as Capterra, GetApp, Software Advice, Slashdot, ITQlick or Spendbase, or from the June 2026 business model and concept expansion research.

## TL;DR

**Verdict: pivot the pitch, then build small.**
Do not build a shop management system, and do not park the project.

- KeysReady works: booking, live repair status over Web Push, messaging, estimates and card payment run end to end for one demo shop (November 2026 assessment, summarized in [HISTORY.md](HISTORY.md)).
- Full shop management is a crowded, expensive category: Tekmetric, Shopmonkey, AutoLeap, Shop-Ware and Shop Boss all start between $179 and $279 a month and run to $449 to $999 (vendor pages).
KeysReady has none of their core (repair orders, labor guides, parts, inventory, inspections, accounting), and catching up is years of work against funded teams.
- The customer-facing layer is where those vendors gate features behind higher tiers or add-ons.
Tekmetric only lists two-way texting on its $439 Scale plan and sells online booking in a $345 per month Marketing add-on; AutoLeap's $199 Essentials has one-way texting only; Shop-Ware's online scheduler is in its $999 Ultimate+ plan or a $249 add-on; Shop Boss puts 24/7 online booking in its $649 Premier Plus plan or a $249 add-on (all vendor pages).
- Nobody in auto offers a free plan, and nobody is open source.
That is the slot: **a free, open-source customer line for small shops** (online booking, live repair status, messages, estimates customers approve and pay from their phone), for the many shops still running on paper and a cell phone.
- The original "free push beats paid SMS" angle is the weak half.
Incumbents already bundle transactional texts, and iPhone web push only works after the customer adds the site to their home screen.
The fix is cheap: make email (already integrated through Brevo) the free fallback channel, and keep SMS as a paid option.
- The 2026 trend helps: incumbents and startups are selling AI receptionists to answer the "is my car ready?" call (Shop-Ware AI Receptionist, Tekmetric Phones, AutoLeap AIR at $99, third-party agents around $109 a month).
KeysReady prevents the call instead of answering it, for free.
- Fit with agencies: web agencies that build sites for local businesses want online booking for their clients, and auto shops are a natural client.
KeysReady can be the open-source engine behind that, so the work pays off twice.
- Gate: before more product code, get 5 to 10 real shops to try a hosted pilot, and measure how many customers get updates (push or email) and whether status calls drop.

## 1. What was actually built

Short version:

| Part | State |
|---|---|
| Booking page, status state machine, staff push on new booking | Works |
| Web Push to customers (VAPID, no Firebase) | Works on Android and desktop; iPhone only after Add to Home Screen |
| Status lookup by reference and phone, driver magic-link accounts, garage | Works |
| Per-booking messaging | Works (4-second polling) |
| Estimates, approve or decline, Stripe Checkout, signed webhook | Works, one platform Stripe account |
| Better Auth foundation | Works for sign-up and sign-in, not yet used by the dashboard |
| Two-way SMS engine | Separate module, not wired in, 2 high-severity bugs |
| Multi-tenant signup, shop settings, staff roles | Missing |
| Email or SMS fallback for status updates | Missing |
| Retention and delete, monitoring, CI, license file | Missing |

## 2. Landing page review

The existing marketing page inside `web/` is polished and honest about the product's mechanics, but:

- It leads with the cost of push versus SMS, which is not what a shop owner buys.
- It shows four price tiers (Free, $39, $99, $149 per location) that cannot be bought and are not marked as planned.
- It is heavy (hero video, animated charts) and redeploys with the app.

The new concept page in `landing/` leads with the outcome ("stop answering 'is my car ready?'"), marks every feature as working in the prototype or planned, marks pricing as planned, and sends every call to action to the n8builds.dev waitlist.

## 3. Competitor landscape

### Shop management systems (the incumbents)

| Product | Entry price | Top listed price | Free plan | Customer-facing features at entry tier | Source |
|---|---|---|---|---|---|
| Tekmetric | $199/mo ($179 annual), Start | $439/mo Scale, Enterprise custom | No (no free trial either) | Digital inspections; two-way texting listed only at Scale; online booking in the $345/mo Marketing add-on; integrated payments listed at Enterprise | tekmetric.com/pricing (vendor page) |
| Shopmonkey | $239/mo ($215 annual), Basic | $499/mo Genius, Multi-Shop custom | No | Unlimited two-way SMS and email, integrated payments, appointment reminders in all plans; customer self-booking not described | shopmonkey.io/pricing (vendor page) |
| AutoLeap | $199/mo ($179 annual), Essentials | $449/mo Elite, Enterprise custom | No (no free trial) | One-way texting only at Essentials, two-way from Pro ($349); payments in every plan; website booking in an add-on Marketing Suite | autoleap.com/pricing (vendor page) |
| Shop-Ware | $279/mo ($251 annual), Startup | $999/mo Ultimate+ | No | Limited two-way texting at Startup; online service scheduler only in Ultimate+ or the $249/mo CRM add-on; payments with transaction fees | shop-ware.com/packages (vendor page) |
| Shop Boss | $199/mo ($179 annual), Gold | $649/mo Premier Plus | No | Two-way text and email and payments in all plans; 24/7 online booking only in Premier Plus or the $249/mo CRM + scheduler add-on | shopboss.net/pricing (vendor page) |
| Mitchell 1 Manager SE | Quote only | Quote only | No | Long-standing desktop shop management; ITQlick estimates $40 to $80 per user per month and about $1,395 upfront | g2.com, getapp.com, itqlick.com (third-party, unverified) |
| Garage360 | $99/mo Basic | $249/mo Genius | No (free trial) | Quotes, invoices, workflow at Basic; inspections at $149; one listing shows a $49.99 founding rate | capterra.com, softwareadvice.com, slashdot.org (third-party, unverified; vendor site did not resolve on 2026-11-01) |

### Customer communication and marketing tools

| Product | Price | Notes | Source |
|---|---|---|---|
| Podium | Quote only on vendor page; Core $399, Pro $599 reported | Messaging, reviews, payments, AI Employee add-on; generic, not auto-aware | podium.com/pricing (vendor page, no prices); getpulsesignal.com (third-party, unverified) |
| Kukui | From $499/mo, Premium about $699 | Websites and marketing for auto shops | capterra.com, getapp.com, spendbase.co (third-party, unverified) |
| Kenect | Quote only | Texting and reviews for auto | getpulsesignal.com (third-party, unverified) |
| Steer (Mechanic Advisor) | $189 to $629 per location reported in June 2026 | CRM and texting for auto | June 2026 research (third-party, unverified; not re-checked) |
| Text Request, Texty Pro, TextBolt | $25 to $549/mo reported | Generic business texting, no concept of a vehicle or repair | June 2026 research (third-party, unverified) |

### AI receptionists (the 2026 trend)

| Product | Price | Notes | Source |
|---|---|---|---|
| Shop-Ware AI Receptionist | Not listed | Answers shop calls | shop-ware.com/ai-receptionist (vendor page) |
| Tekmetric Phones | Not listed | Calls tied to customer profiles and repair orders; launch date not confirmed | 01net.it press release (third-party, unverified) |
| AutoLeap AIR | $99/mo | Separate product on the AutoLeap pricing page | autoleap.com/pricing (vendor page) |
| AgentZap and similar | About $109/mo | AI phone answering that integrates with Tekmetric or Shopmonkey | agentzap.ai (vendor marketing, unverified) |

### Top five that matter

1. **Shopmonkey**: the clearest "customer communication included" story at $239; the benchmark for what a shop expects texting and payments to feel like.
2. **Tekmetric**: market leader with the most aggressive tier-gating of customer features, which is exactly the gap KeysReady fills.
3. **AutoLeap**: one-way texting at entry, and a $99 AI receptionist that attacks the same pain from the opposite side.
4. **Shop Boss and Shop-Ware**: both charge $249 a month extra for online booking plus CRM, which sets a price anchor for KeysReady's paid plan far below.
5. **Garage360**: the low-price shop management option ($99), the most likely "good enough" alternative for a tiny shop.

## 4. Market and disruption analysis

### Who pays

The buyer is the owner of an independent 1 to 3 bay shop who also turns wrenches and answers the phone.
The June 2026 research cites that 81% of shops have 8 or fewer bays and that 56% of small shops call software cost-prohibitive (third-party survey figures, unverified).
These owners already pay for a phone line, a website, maybe QuickBooks, and often nothing else.

### Size signals

- IBISWorld counts 302,754 US auto mechanic businesses in 2025 and about 307,000 in 2026, including non-employer sole proprietors (ibisworld.com, third-party).
- Census-based counts of employer establishments (NAICS 8111) are around 166,000 (reported by withorbital.com, unverified).
- Auto body shops are a separate count of about 104,000 (ibisworld.com, third-party).
- Even 1% of the smaller count is 1,600 shops, which is plenty for an open-source project with a hosted plan.

### Where incumbents are weak

- **Price floor**: $179 to $279 a month before add-ons, no free plan, no free trial at Tekmetric or AutoLeap.
- **Tier gating of the customer experience**: two-way texting and online booking sit in top tiers or $249 to $345 add-ons.
- **Closed and desktop-shaped**: none is open source, none can be self-hosted, and none can be embedded in an agency-built website without their branding.
- **Onboarding**: demos, sales calls and data migration, which a one-bay shop will not sit through.

### The 2026 disruption angle

- AI receptionists are the funded answer to phone overload, at $99 to $109 a month on top of shop management.
Most "is it ready?" calls should never happen: a status page and a timely notification remove them for free.
- iOS 26 opens home-screen sites as web apps by default, which slightly lowers push friction, but iPhone push still requires an explicit install, so email has to be the default fallback (magicbell.com, onesignal.com, third-party).
- Agencies build websites for local businesses and need a booking and status feature they can embed without a $200 subscription per client.
An open-source, embeddable engine fits that channel.

### Fit with agencies

Agencies that build websites for local businesses often list online booking as a feature they would like to offer.
KeysReady's booking, status and estimate flow could power that for auto and repair clients first, with a hosted KeysReady plan for shops that come directly.
This shares engineering cost and gives KeysReady a first distribution channel.

## 5. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| iPhone customers never install, so push reaches few customers | High | Email status updates on the free plan; SMS on the paid plan; status page needs no install; measure the share of customers reached in the pilot |
| Incumbent drops price or bundles booking at entry tiers | Medium | Stay free and open source; target shops with no software at all, where incumbents are not competing |
| "Good enough" substitutes (Google Business Profile booking, Square Appointments, a text from the owner's phone) | Medium | Lead with repair status and estimates, which generic tools do not model |
| Payments liability (chargebacks, Stripe Connect onboarding) | Medium | Stripe Connect Standard, so each shop is its own merchant of record |
| Data protection (customer names, phones, vehicles) | Medium | Retention and delete before the hosted beta; self-host option for privacy-sensitive shops |
| SMS compliance (10DLC, TCPA) when SMS ships | Medium | Paid plan only, done-for-you registration, reuse the existing consent and STOP engine after fixing its bugs |
| Founder time spread across several concepts | High | Share the engine with agency booking work; hard decision gate after the pilot |

## 6. Relaunch plan

### Positioning

**KeysReady is the free, open-source customer line for small auto shops: online booking, live repair status, and estimates customers approve and pay from their phone.**
Hero: "Stop answering 'Is my car ready?'"
Not a shop management system; it works next to paper, spreadsheets or one.

### MVP scope (in order)

1. Multi-tenant signup with a per-shop booking link and status page.
2. Email status updates as the default channel, Web Push as the upgrade.
3. Live status page per booking (no account needed).
4. Estimates with approve and pay through Stripe Connect.
5. Messages, then review requests after pickup.

### Pricing (planned, see [PRODUCT.md](PRODUCT.md))

- Self-host: free forever (open source).
- Hosted Free: one shop, one staff seat, unlimited bookings, status pages, email and push updates.
- Hosted Pro: $29 a month for SMS updates, service reminders, review requests, up to five staff and no KeysReady branding.
- Card payments at Stripe's standard rates on every plan, with no KeysReady fee during the beta.

### Stack

Keep the existing Next.js app and Turso.
Move hosting to Cloudflare Workers with OpenNext only if it stays simple; the static concept landing already runs there.
Brevo or Resend for email, `web-push` for push, the existing SMS engine for SMS after its fixes.

### Milestones

M0 hardening (1 to 2 weeks), M1 multi-tenant MVP (3 to 4 weeks), M2 open-source release (1 to 2 weeks), M3 hosted pilot with 5 to 10 shops (4 to 6 weeks), then a go or park decision.

## Sources

- tekmetric.com/pricing, shopmonkey.io/pricing, autoleap.com/pricing, shop-ware.com/packages, shop-ware.com/ai-receptionist, shopboss.net/pricing, podium.com/pricing (vendor pages, fetched 2026-11-01).
- capterra.com, softwareadvice.com, slashdot.org (Garage360); g2.com, getapp.com, itqlick.com (Mitchell 1 Manager SE); capterra.com, getapp.com, spendbase.co (Kukui); getpulsesignal.com (Podium, Kenect); agentzap.ai; 01net.it (Tekmetric Phones) (third-party, unverified).
- ibisworld.com (number of businesses, auto mechanics and auto body shops); withorbital.com (Census NAICS 8111 count, unverified).
- magicbell.com, onesignal.com, notificare.com (iOS web push requirements; third-party).
- The June 2026 business model and concept expansion research (not re-checked here unless stated; summarized in [HISTORY.md](HISTORY.md)).
