import Link from "next/link";
import type { Metadata } from "next";
import Reveal from "@/components/marketing/Reveal";
import HeroNotifications from "@/components/marketing/HeroNotifications";
import PushVsSmsViz from "@/components/marketing/PushVsSmsViz";
import FaqAccordion from "@/components/marketing/FaqAccordion";
import HeroVideo from "@/components/marketing/HeroVideo";
import { TIERS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "KeysReady — your customers stop calling",
  description:
    "KeysReady books the repair and pushes the customer at every step — received, in progress, ready for pickup. Two-way chat and card payments built in. Free to send, no app store, no per-text fees.",
};

/* Stock imagery: Pexels & Unsplash (free, hotlink-permitted). Each URL was
   independently verified live (200 + correct content-type) before use.
   Credits: Artem Podrez, Gustavo Fring (Pexels); Charis Gegelman, Mehmet
   Talha Onuk, SumUp (Unsplash). */
const A = {
  heroVideo:
    "https://videos.pexels.com/video-files/8987200/8987200-hd_1920_1080_30fps.mp4",
  heroPoster:
    "https://images.pexels.com/videos/8987200/auto-automobile-automotive-car-8987200.jpeg?auto=compress&cs=tinysrgb&w=1920",
  engine:
    "https://images.pexels.com/photos/6870298/pexels-photo-6870298.jpeg?auto=compress&cs=tinysrgb&w=1600",
  problem:
    "https://images.pexels.com/photos/6870321/pexels-photo-6870321.jpeg?auto=compress&cs=tinysrgb&w=1200",
  dashboard:
    "https://images.pexels.com/photos/6870317/pexels-photo-6870317.jpeg?auto=compress&cs=tinysrgb&w=1200",
  customer:
    "https://images.unsplash.com/photo-1541040550327-d23059d44cd2?auto=format&fit=crop&w=900&q=80",
  keys: "https://images.unsplash.com/photo-1727893512947-8bdc773ceb02?auto=format&fit=crop&w=1600&q=80",
  payment:
    "https://images.unsplash.com/photo-1742836531239-1fe146bf7e3f?auto=format&fit=crop&w=1200&q=80",
};

const STATUS_LADDER = [
  { label: "Booked", who: "Shop pinged", note: "“New booking — 2018 Civic, brakes.”" },
  { label: "Confirmed", who: "Customer pinged", note: "“You’re on the schedule for Tue 9am.”" },
  { label: "In progress", who: "Customer pinged", note: "“We’ve started — ready by ~4:30pm.”" },
  { label: "Ready", who: "Customer pinged", note: "“Your car is ready for pickup.”" },
  { label: "Paid", who: "Shop pinged", note: "“Payment received — $312.40.”" },
];

const PILLARS = [
  {
    tag: "Notify",
    title: "The car’s-ready ping",
    body: "A booking page on your own URL and a free push at every status change. Customers stop calling to ask — their phone buzzes the moment it’s done.",
    img: A.customer,
    alt: "A customer smiling at their phone after getting a notification",
  },
  {
    tag: "Track",
    title: "Two-way messages",
    body: "Questions get answered in a thread, not on hold. “Running 10 late,” “send a photo of the worn pad.” Both sides get pushed. No more phone tag.",
    img: A.dashboard,
    alt: "A mechanic using a tablet in the shop to manage jobs",
  },
  {
    tag: "Transact",
    title: "Quote, approve, pay",
    body: "Build a line-item estimate, send it, the customer approves and pays by card from their phone. Money collected before pickup — not chased after.",
    img: A.payment,
    alt: "A hand tapping a card on a contactless reader to pay",
  },
];

const FEATURES = [
  ["Your own booking page", "Customers book and opt into updates in one tap. No call, no paper."],
  ["Live status board", "Drag a job Confirmed → In progress → Ready. Every move auto-pushes the customer."],
  ["Installable, not an app", "It’s a website. Add to Home Screen and it behaves like a native app — no App Store, no review."],
  ["Magic-link sign-in", "Drivers sign in with an email link — no password to forget. Staff use email + password."],
  ["Built-in invoicing", "Line items in cents, Stripe Checkout, paid flag on the booking. No card data ever touches you."],
  ["No Google, no Firebase", "Web Push runs on open VAPID keys — no third-party identity graph on your customers."],
];

const FAQ = [
  { q: "Do customers install anything?", a: "No. It’s a website — they tap “enable alerts” in the browser. On iPhone they Add to Home Screen first, then alerts arrive like a native app." },
  { q: "How is push free when texting costs money?", a: "Web push rides the browser’s own push service (Apple, Google, Mozilla) at no per-message cost. SMS bills ~1¢+ per text via a carrier. We pass the savings on: unlimited push on the free plan." },
  { q: "What about customers who never opt in?", a: "That’s the paid tier — SMS picks up the holdouts, and you only pay per text for the people who didn’t install. Push covers the rest for free." },
  { q: "Is this another $300/mo shop platform?", a: "No. The notify-your-customers core is free forever. You pay only when you want SMS or multi-location." },
];

export default function HomePage() {
  return (
    <div>
      <link rel="preconnect" href="https://videos.pexels.com" />
      <link rel="preconnect" href="https://images.pexels.com" />
      <link rel="preconnect" href="https://images.unsplash.com" />
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative isolate overflow-hidden bg-neutral-950">
        <HeroVideo src={A.heroVideo} poster={A.heroPoster} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-neutral-950/90 via-neutral-950/70 to-brand/30" />

        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-24 sm:py-32 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur">
              Free forever · no app store · no SMS fees
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Your customers stop calling.{" "}
              <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">
                Your car’s-ready ping does the talking.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-neutral-200">
              KeysReady books the repair and pushes the customer at every
              step — received, in progress, ready for pickup. Two-way chat and
              card payments built in. Free to send. No app to install.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[54px] items-center justify-center rounded-xl bg-brand px-8 text-base font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-xl hover:shadow-brand/40"
              >
                Start free →
              </Link>
              <Link
                href="/book"
                className="inline-flex min-h-[54px] items-center justify-center rounded-xl border border-white/30 bg-white/5 px-8 text-base font-semibold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                See a demo booking
              </Link>
            </div>
            <p className="mt-4 text-sm text-neutral-300">
              Works on any phone · live in about a minute ·{" "}
              <Link href="/driver/login" className="font-semibold text-white underline-offset-2 hover:underline">
                Are you a driver? Track your repair →
              </Link>
            </p>
          </Reveal>

          <Reveal delay={150} y={32}>
            <HeroNotifications />
          </Reveal>
        </div>
      </section>

      {/* ───────────────────── Stat band ───────────────────── */}
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-1 divide-y divide-neutral-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["~90", "“is it ready?” calls/day a 30-car shop can stop fielding"],
            ["$0", "per notification — web push has no carrier fee"],
            ["~60s", "to your first ping — no install, no contract"],
          ].map(([big, small], i) => (
            <Reveal key={small} delay={i * 90} className="px-2 py-8 text-center">
              <p className="text-4xl font-extrabold text-neutral-900">{big}</p>
              <p className="mx-auto mt-2 max-w-[15rem] text-sm text-neutral-600">{small}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────────────────── The problem ───────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <p className="text-sm font-bold uppercase tracking-wide text-brand">The 3pm problem</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              Half the front desk’s day is one question: “Is my car ready yet?”
            </h2>
            <p className="mt-4 text-lg text-neutral-600">
              Every call pulls a tech off a lift or a writer off an estimate.
              The customer isn’t annoying — they’re anxious, because the only way
              to know is to call. KeysReady removes the reason to call: the
              moment the status changes, their phone buzzes.
            </p>
          </Reveal>
          <Reveal delay={120} className="group order-1 overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5 lg:order-2">
            <img
              src={A.problem}
              alt="A mechanic on the phone beside a car, fielding a status call"
              width={1200}
              height={800}
              loading="lazy"
              className="aspect-[3/2] w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </Reveal>
        </div>
      </section>

      {/* ─────────────────── The status ladder ─────────────────── */}
      <section className="border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              One booking. A ping at every step.
            </h2>
            <p className="mt-3 text-neutral-600">
              You just move the job across the board. KeysReady fires the right
              notification to the right person — automatically.
            </p>
            <div className="group mt-6 hidden overflow-hidden rounded-3xl shadow-lg ring-1 ring-black/5 lg:block">
              <img
                src={A.engine}
                alt="A mechanic working under the hood of a car in a modern garage"
                width={1600}
                height={1067}
                loading="lazy"
                className="aspect-[3/2] w-full object-cover transition duration-500 group-hover:scale-105"
              />
            </div>
          </Reveal>
          <Reveal delay={120}>
            <ol className="space-y-3">
              {STATUS_LADDER.map((s, i) => (
                <li key={s.label} className="flex items-start gap-4 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-brand/40 hover:shadow-sm">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand font-bold text-white">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold text-neutral-900">{s.label}</span>
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{s.who}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-600">{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ──────────────── Notify / Track / Transact ──────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            It grows with you: Notify → Track → Transact
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Start with the free ping. Turn on messaging and payments the day you
            want them. Same app, same login.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.tag} delay={i * 110} className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="overflow-hidden">
                  <img
                    src={p.img}
                    alt={p.alt}
                    width={1200}
                    height={800}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover transition duration-500 hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <span className="inline-flex w-fit items-center rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    {p.tag}
                  </span>
                  <h3 className="mt-4 text-xl font-extrabold text-neutral-900">{p.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{p.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────────── Push vs SMS — stats & charts ─────────────── */}
      <section className="border-y border-neutral-200 bg-neutral-900 text-white">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Why the free plan is actually free
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-300">
              Most shop platforms are SMS resellers — every text costs them money,
              so they cap you and charge a subscription. We lead with push, which
              costs ~$0 to send. Here’s what that means in numbers.
            </p>
          </Reveal>
          <Reveal delay={120} className="mt-10">
            <PushVsSmsViz />
          </Reveal>
        </div>
      </section>

      {/* ─────────────────── Feature grid ─────────────────── */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Everything a small shop needs — nothing it doesn’t
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([t, d], i) => (
            <Reveal key={t} delay={(i % 3) * 90} className="h-full">
              <div className="h-full rounded-2xl border border-neutral-200 p-5 transition duration-300 hover:-translate-y-1 hover:border-brand/40 hover:shadow-md">
                <h3 className="font-bold text-neutral-900">{t}</h3>
                <p className="mt-2 text-sm text-neutral-600">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ─────────────────── Pricing (inline) ─────────────────── */}
      <section id="pricing" className="scroll-mt-20 border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              Simple pricing. Free is actually free.
            </h2>
            <p className="mt-3 max-w-2xl text-neutral-600">
              Web push costs us nothing to send, so the free plan has no message
              cap. You only pay when you want SMS for customers who haven’t
              installed the app.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {TIERS.map((t, i) => (
              <Reveal key={t.name} delay={i * 110} className="h-full">
                <div
                  className={`flex h-full flex-col rounded-3xl border bg-white p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    t.highlight ? "border-brand shadow-lg ring-2 ring-brand/20" : "border-neutral-200"
                  }`}
                >
                  {t.highlight && (
                    <span className="mb-3 inline-flex w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-brand">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold text-neutral-900">{t.name}</h3>
                  <p className="mt-2">
                    <span className="text-4xl font-extrabold text-neutral-900">{t.price}</span>
                    <span className="text-neutral-500">{t.cadence}</span>
                  </p>
                  <p className="mt-3 text-sm text-neutral-600">{t.blurb}</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-neutral-700">
                    {t.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-brand">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/dashboard"
                    className={`mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl px-5 font-semibold transition ${
                      t.highlight ? "bg-brand text-white hover:bg-brand-dark" : "border border-neutral-300 text-neutral-800 hover:bg-neutral-100"
                    }`}
                  >
                    {t.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Multi-location? Multi-Shop is $149/location.{" "}
            <Link href="/pricing" className="font-semibold text-brand hover:underline">
              See full pricing details →
            </Link>
          </p>
        </div>
      </section>

      {/* ─────────────────────── FAQ ─────────────────────── */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <Reveal>
          <h2 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Straight answers
          </h2>
        </Reveal>
        <Reveal delay={100} className="mt-10">
          <FaqAccordion items={FAQ} />
        </Reveal>
      </section>

      {/* ─────────────────── Final CTA ─────────────────── */}
      <section className="relative isolate overflow-hidden">
        <img
          src={A.keys}
          alt="Handing over car keys at an auto service counter"
          width={1600}
          height={1067}
          loading="lazy"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand/95 to-brand-dark/90" />
        <div className="mx-auto max-w-5xl px-4 py-24 text-center">
          <Reveal>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Send your first “your car is ready” today.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">
              Free plan, unlimited push, live in about a minute. Add SMS and card
              payments whenever you’re ready.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[54px] items-center justify-center rounded-xl bg-white px-8 text-base font-semibold text-brand shadow-lg transition hover:-translate-y-0.5 hover:bg-neutral-100"
              >
                Open the shop dashboard
              </Link>
              <Link
                href="/pricing"
                className="inline-flex min-h-[54px] items-center justify-center rounded-xl border border-white/50 px-8 text-base font-semibold text-white transition hover:bg-white/10"
              >
                See pricing
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
