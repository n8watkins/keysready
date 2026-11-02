import { ArrowRight, Check, Database, GitBranch, Mail, MessageSquareText, Minus, PhoneOff, Radar, Server, ShieldCheck, Smartphone } from "lucide-react";
import { HeroDemo } from "./HeroDemo";
import { calls, channels, comparison, faqs, featureGroups, statusHelp, steps, tiers, type Cell, type Status } from "@/lib/content";
import { site } from "@/lib/site";

function SectionHeading({
  eyebrow,
  title,
  lede,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  id: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lede ? <p className="mt-4 text-lg leading-relaxed text-muted text-pretty">{lede}</p> : null}
    </div>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    Prototype: "bg-ready-soft text-ready",
    MVP: "bg-accent-soft text-accent",
    Beta: "bg-pending-soft text-pending",
    Later: "bg-bg-sunk text-muted",
  };
  return (
    <span
      title={statusHelp[status]}
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      <span className="sr-only">Status: </span>
      {status}
    </span>
  );
}

function WaitlistButton({ children = "Join the waitlist", className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <a
      href={site.waitlistUrl}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink px-6 text-base font-semibold text-bg transition hover:opacity-90 ${className}`}
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </a>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/70 px-3 py-1 text-xs font-medium text-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            For small auto shops · In development · Open source
          </p>
          <h1
            id="hero-title"
            className="mt-6 font-display text-[2.55rem] font-black leading-[1.02] tracking-tight text-balance [font-stretch:92%] sm:text-6xl lg:text-[3.9rem]"
          >
            Stop answering <span className="text-accent">&ldquo;Is my car ready?&rdquo;</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted text-pretty">
            KeysReady gives your customers online booking, live repair status and estimates they approve and pay from their phone. They
            always know where their car is, so you can stay under the hood instead of on the phone.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <WaitlistButton />
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-line-strong bg-surface px-6 text-base font-semibold text-ink transition hover:border-ink"
            >
              See how it works
            </a>
          </div>
          <ul className="mt-8 grid gap-2 text-sm text-muted sm:grid-cols-2">
            {["Free for a small shop", "No app for customers to download", "Payments go to your own Stripe", "Open source, self-host if you like"].map(
              (t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-ready" aria-hidden="true" />
                  {t}
                </li>
              ),
            )}
          </ul>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}

export function Calls() {
  return (
    <section aria-labelledby="calls-title" className="border-t border-line bg-code-bg text-code-ink">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex items-start gap-3">
          <PhoneOff className="mt-1 size-5 shrink-0 text-accent" aria-hidden="true" />
          <h2 id="calls-title" className="max-w-2xl font-display text-2xl font-extrabold tracking-tight text-balance sm:text-3xl">
            Three calls you take every day, answered before the phone rings
          </h2>
        </div>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
          {calls.map((c) => (
            <li key={c.question} className="bg-code-bg p-6">
              <p className="font-display text-xl font-bold tracking-tight">{c.question}</p>
              <p className="mt-3 leading-relaxed text-code-ink/70">{c.answer}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" id="how-it-works" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="how-title"
          eyebrow="How it works"
          title="From booking to keys in hand, without phone tag"
          lede="KeysReady is the customer side of your shop. Keep your paper tickets, spreadsheet or shop software for the work itself."
        />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative flex flex-col rounded-2xl border border-line bg-bg p-6">
              <span className="font-mono text-sm font-semibold text-accent">0{i + 1}</span>
              <h3 className="mt-3 font-display text-xl font-bold tracking-tight">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section aria-labelledby="features-title" id="features" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            id="features-title"
            eyebrow="Features"
            title="Everything between &ldquo;can you fit me in?&rdquo; and &ldquo;thanks, see you next time&rdquo;"
            lede="Green labels work in today's single-shop prototype. The rest are planned, and the label says for which release."
          />
          <dl className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm text-muted sm:grid-cols-[auto_1fr_auto_1fr] lg:grid-cols-[auto_1fr]">
            {(Object.keys(statusHelp) as Status[]).map((s) => (
              <div key={s} className="contents">
                <dt className="justify-self-start">
                  <StatusPill status={s} />
                </dt>
                <dd>{statusHelp[s].replace("Planned for the ", "").replace("Planned ", "").replace("Works in the prototype today", "works today")}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-12 space-y-12">
          {featureGroups.map((g) => (
            <div key={g.id} className="grid gap-6 border-t border-line pt-10 lg:grid-cols-[18rem_1fr] lg:gap-12">
              <div>
                <h3 className="font-display text-2xl font-extrabold tracking-tight">{g.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{g.lede}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {g.features.map((f) => (
                  <li key={f.title} className="rounded-2xl border border-line bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold leading-snug">{f.title}</h4>
                      <StatusPill status={f.status} />
                    </div>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const channelIcons = { Email: Mail, Notifications: Smartphone, "Text messages": MessageSquareText } as const;

export function Updates() {
  return (
    <section aria-labelledby="updates-title" id="updates" className="border-t border-line bg-bg-sunk">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="updates-title"
          eyebrow="How customers get updates"
          title="Updates that reach every customer, not just the ones who install something"
          lede="Every update also lives on a status page that opens from a link. On top of that, customers get whichever channel suits them."
        />
        <ul className="mt-12 grid gap-5 md:grid-cols-3">
          {channels.map((c) => {
            const Icon = channelIcons[c.name];
            return (
              <li key={c.name} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-bg-sunk text-ink">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <StatusPill status={c.status} />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{c.name}</h3>
                <p className="mt-1 text-sm font-semibold text-accent">{c.plan === "Free" ? "Included free" : "On the Pro plan"}</p>
                <p className="mt-3 leading-relaxed text-muted">{c.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function OpenSource() {
  const points = [
    {
      icon: GitBranch,
      title: "Open-source code",
      body: "The whole app: booking, status, messages, estimates and payments. Read it, run it, change it.",
    },
    {
      icon: Server,
      title: "Runs on your own server",
      body: "Any Node host with a SQLite or libSQL database. Bring your own email, text and Stripe accounts.",
    },
    {
      icon: Database,
      title: "Your customers stay yours",
      body: "Self-hosted, customer data never reaches us. Hosted, you can export everything or delete it any time.",
    },
    {
      icon: ShieldCheck,
      title: "Released before the hosted beta",
      body: "The self-host release comes first, so the open-source promise is real from day one.",
    },
  ];
  return (
    <section aria-labelledby="oss-title" id="open-source" className="border-t border-line">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-24">
        <div>
          <SectionHeading
            id="oss-title"
            eyebrow="Open source and self-host"
            title="Use ours, or run your own"
            lede="Same app either way. Most shops will want the hosted version; agencies, developers and privacy-minded owners can host it themselves."
          />
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p.title}>
                <p.icon className="size-5 text-accent" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="self-center">
          <div className="overflow-hidden rounded-2xl border border-line-strong bg-code-bg text-code-ink">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <p className="font-mono text-xs text-code-muted">terminal</p>
              <p className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium text-code-muted">Planned setup</p>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-7">
              <code>
                <span className="text-code-muted"># get the app and fill in your keys</span>
                {"\n"}
                <span className="text-[#ff5a4e]">$</span> git clone https://github.com/n8watkins/keysready
                {"\n"}
                <span className="text-[#ff5a4e]">$</span> cp .env.example .env
                {"\n\n"}
                <span className="text-code-muted"># create your shop and start it</span>
                {"\n"}
                <span className="text-[#ff5a4e]">$</span> npm run setup
                {"\n"}
                <span className="text-[#43d095]">✓</span> database ready, push keys generated
                {"\n"}
                <span className="text-[#ff5a4e]">$</span> npm start
              </code>
            </pre>
          </div>
          <p className="mt-3 text-xs text-muted">The repository is private until the self-host release. This is the setup we are designing toward.</p>
        </div>
      </div>
    </section>
  );
}

function CellValue({ value, strong }: { value: Cell; strong?: boolean }) {
  if (value === true)
    return (
      <span className="inline-flex items-center gap-1.5 align-middle text-ready">
        <Check className="size-4" aria-hidden="true" />
        <span className="sr-only">Yes</span>
      </span>
    );
  if (value === false)
    return (
      <span className="inline-flex items-center align-middle text-muted/70">
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">No</span>
      </span>
    );
  return <span className={strong ? "font-medium text-ink" : "text-ink/85"}>{value}</span>;
}

export function Compare() {
  return (
    <section aria-labelledby="compare-title" id="compare" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="compare-title"
          eyebrow="Compare"
          title="Not another shop management system"
          lede="Tekmetric, Shopmonkey and AutoLeap run the whole shop, and they are good at it. KeysReady only does the customer side, for the shops that do not need or cannot justify the rest."
        />
        <p className="mt-8 text-xs text-muted md:hidden">Swipe the table sideways to see every product.</p>
        <div className="relative mt-3 overflow-x-auto rounded-2xl border border-line md:mt-10">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <caption className="sr-only">Comparison of KeysReady (planned), Tekmetric, Shopmonkey and AutoLeap</caption>
            <thead>
              <tr className="border-b border-line bg-bg">
                <th scope="col" className="sticky left-0 z-10 w-40 bg-bg px-4 py-3.5 font-medium text-muted md:static md:w-auto">
                  <span className="sr-only">Capability</span>
                </th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">
                  KeysReady <span className="font-sans text-xs font-medium text-muted">(planned)</span>
                </th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">Tekmetric</th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">Shopmonkey</th>
                <th scope="col" className="px-4 py-3.5 font-display text-base font-bold">AutoLeap</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((r) => (
                <tr key={r.row} className="border-b border-line last:border-0">
                  <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 font-normal text-muted md:static">
                    {r.row}
                  </th>
                  <td className="bg-ready-soft/40 px-4 py-3">
                    <CellValue value={r.keysready} strong />
                  </td>
                  <td className="px-4 py-3">
                    <CellValue value={r.tekmetric} />
                  </td>
                  <td className="px-4 py-3">
                    <CellValue value={r.shopmonkey} />
                  </td>
                  <td className="px-4 py-3">
                    <CellValue value={r.autoleap} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          KeysReady column describes the planned product. Competitor prices are monthly list prices for the entry plan, from
          tekmetric.com/pricing, shopmonkey.io/pricing and autoleap.com/pricing, checked 1 November 2026. &ldquo;Not described&rdquo;
          means the pricing page lists appointments and reminders but not customer self-booking.
        </p>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section aria-labelledby="pricing-title" id="pricing" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          title="Free for a small shop. One simple upgrade."
          lede="Card payments cost Stripe's standard fees on every plan. KeysReady adds no payment fee during the beta."
        />
        <p className="mt-6 inline-flex items-start gap-2 rounded-xl border border-pending/30 bg-pending-soft px-3.5 py-2 text-sm text-ink">
          <Radar className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden="true" />
          Planned pricing. Nothing is billable today, and prices may change before the hosted beta.
        </p>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {tiers.map((t) => (
            <li
              key={t.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${t.highlight ? "border-ink bg-surface shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)]" : "border-line bg-surface"}`}
            >
              {t.highlight ? (
                <span className="absolute -top-3 left-6 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-bg">Start here</span>
              ) : null}
              <h3 className="font-display text-xl font-bold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted">{t.blurb}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-black tracking-tight">{t.price}</span>
                <span className="text-sm text-muted">{t.cadence}</span>
              </p>
              <ul className="mt-5 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ready" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-7">
                <a
                  href={site.waitlistUrl}
                  className={`inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition ${t.highlight ? "bg-ink text-bg hover:opacity-90" : "border border-line-strong text-ink hover:border-ink"}`}
                >
                  {t.cta}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section aria-labelledby="faq-title" id="faq" className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:py-24">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Straight answers" lede="Including the ones about what does not exist yet." />
        <div className="divide-y divide-line border-y border-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-4 text-left font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  className="relative size-4 shrink-0 before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded before:bg-ink after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-ink after:transition group-open:after:scale-y-0"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-5 pr-8 leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EarlyAccess() {
  return (
    <section aria-labelledby="early-title" id="early-access" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="grid gap-10 rounded-3xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Early access</p>
            <h2 id="early-title" className="mt-3 font-display text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Want your phone to ring less?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              The first release lets any shop sign up and get a booking link, live status pages, email and push updates, estimates and
              pay by phone. A small free pilot with real shops follows. Join the list to hear when each step is ready.
            </p>
          </div>
          <div className="lg:justify-self-end">
            <ol className="space-y-3 text-sm">
              {[
                ["1", "Self-host release", "Open source, on your own server"],
                ["2", "Hosted pilot", "We run it for a small group of shops, free"],
                ["3", "Pro plan", "Text updates, reminders and reviews"],
              ].map(([n, title, body]) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-xs font-semibold text-accent">
                    {n}
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="text-muted">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <WaitlistButton className="mt-7 w-full sm:w-auto" />
            <p className="mt-3 text-sm text-muted">The waitlist lives on n8builds.dev, where I build in public. One email when each release is ready.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
