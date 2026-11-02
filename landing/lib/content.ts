/**
 * Landing page copy. Every claim here must match what the product in ../web/ does.
 * "Prototype" means it runs in the single-shop demo today; it is not open to shops yet.
 * Every other status describes the plan, not shipped software.
 */

export type Status = "Prototype" | "MVP" | "Beta" | "Later";

export const statusHelp: Record<Status, string> = {
  Prototype: "Works in the prototype today",
  MVP: "Planned for the first release",
  Beta: "Planned for the hosted beta",
  Later: "Planned after the beta",
};

export const calls = [
  {
    question: "\"Is my car ready yet?\"",
    answer: "Every status change reaches the customer by email or notification, and a live status page answers the rest.",
  },
  {
    question: "\"How much is this going to cost?\"",
    answer: "Send the estimate to their phone. They tap approve or decline, and you get a timestamped yes.",
  },
  {
    question: "\"Can I pay when I pick it up?\"",
    answer: "They pay the approved estimate from their phone before they arrive, so pickup takes a minute.",
  },
] as const;

export const steps = [
  {
    title: "They book online",
    body: "Share your booking link on your website, Google profile or texts. Customers pick a service and enter their car. No account, no app.",
  },
  {
    title: "You tap the status",
    body: "Move each car from Received to In progress to Ready on a board that works on your phone in the bay.",
  },
  {
    title: "They hear right away",
    body: "Each change goes out by email or notification, with a status page they can check any time. SMS comes with Pro.",
  },
  {
    title: "They approve and pay",
    body: "Estimates and payment happen on the customer's phone, and the money goes to your own Stripe account.",
  },
] as const;

export type Feature = { title: string; body: string; status: Status };
export type FeatureGroup = { id: string; title: string; lede: string; features: Feature[] };

export const featureGroups: FeatureGroup[] = [
  {
    id: "booking",
    title: "Booking",
    lede: "Fewer calls to book, and a new-booking alert on your phone the moment one lands.",
    features: [
      { title: "Online booking page", body: "Customers pick a service and enter their car and contact details. No account needed.", status: "Prototype" },
      { title: "New-booking alerts", body: "A notification on every staff phone as soon as someone books.", status: "Prototype" },
      { title: "Your own booking link", body: "One link per shop to put on your site, Google profile or email signature.", status: "MVP" },
      { title: "Hours and closed days", body: "Booking only offers days you are open.", status: "MVP" },
    ],
  },
  {
    id: "status",
    title: "Live repair status",
    lede: "The part that stops the phone ringing: customers always know where their car is.",
    features: [
      { title: "One-tap status board", body: "Received, In progress, Ready, Picked up. Built for a phone in a greasy hand.", status: "Prototype" },
      { title: "Notifications, no app store", body: "Web push on every status change, from the browser they already use.", status: "Prototype" },
      { title: "Live status page", body: "A page per job that answers \"is it ready?\" before they think to call.", status: "Prototype" },
      { title: "Email updates", body: "The same updates by email for customers who never turn on notifications.", status: "MVP" },
      { title: "ETA and notes", body: "\"Waiting on parts, expected Thursday\" right on the status page.", status: "MVP" },
      { title: "Text message updates", body: "SMS for customers who want texts, with carrier registration done for you.", status: "Beta" },
    ],
  },
  {
    id: "estimates",
    title: "Messages, estimates and payment",
    lede: "Get the yes on extra work and get paid, without phone tag.",
    features: [
      { title: "Messages per job", body: "Two-way chat attached to the car, so nothing gets lost in your personal texts.", status: "Prototype" },
      { title: "Estimates on their phone", body: "Line items in your words. The customer approves or declines with one tap.", status: "Prototype" },
      { title: "Pay by phone", body: "Card payment for the approved estimate through Stripe. No card data stored by KeysReady.", status: "Prototype" },
      { title: "Payouts to your Stripe account", body: "You are the merchant. Money goes straight to your account.", status: "MVP" },
      { title: "Photos on estimates", body: "Show the worn brake pad next to the price.", status: "Beta" },
    ],
  },
  {
    id: "retention",
    title: "Bringing customers back",
    lede: "The same free channel that says \"ready\" can say \"due for service\".",
    features: [
      { title: "Customer garage", body: "Customers keep their cars and repair history for next time.", status: "Prototype" },
      { title: "Review requests", body: "One message with your Google review link after pickup.", status: "Beta" },
      { title: "Service reminders", body: "\"Your oil change is due\" by email, notification or text.", status: "Beta" },
      { title: "Export and delete", body: "Download your customers any time. Delete a customer's data on request.", status: "MVP" },
    ],
  },
];

export const channels = [
  {
    name: "Email",
    plan: "Free",
    body: "Every update by email, for every customer with an address. The default, so nobody is left out.",
    status: "MVP" as Status,
  },
  {
    name: "Notifications",
    plan: "Free",
    body: "Web push with no app store. Works in Android and desktop browsers. On iPhone it works after the customer adds the page to their home screen.",
    status: "Prototype" as Status,
  },
  {
    name: "Text messages",
    plan: "Pro",
    body: "SMS for customers who want texts. We handle carrier registration, STOP and HELP replies, and quiet hours.",
    status: "Beta" as Status,
  },
] as const;

export type Tier = {
  name: string;
  price: string;
  cadence: string;
  blurb: string;
  features: string[];
  cta: string;
  highlight?: boolean;
};

export const tiers: Tier[] = [
  {
    name: "Self-host",
    price: "$0",
    cadence: "forever",
    blurb: "The open-source app on your own server.",
    features: [
      "Everything in the app",
      "Your own email, SMS and Stripe keys",
      "Your data never leaves your server",
      "Community support",
    ],
    cta: "Get notified at release",
  },
  {
    name: "Free",
    price: "$0",
    cadence: "hosted",
    blurb: "A real front desk for a small shop, run by us.",
    features: [
      "1 shop, 1 staff seat",
      "Unlimited bookings and status pages",
      "Unlimited email and push updates",
      "Messages, estimates and pay by phone",
    ],
    cta: "Join the waitlist",
    highlight: true,
  },
  {
    name: "Pro",
    price: "$29",
    cadence: "/mo per shop",
    blurb: "Texts, reminders and reviews for a busier shop.",
    features: [
      "Everything in Free",
      "Text updates (about 500 a month)",
      "Review requests and service reminders",
      "Up to 5 staff, your branding only",
    ],
    cta: "Join the waitlist",
  },
];

export type Cell = boolean | string;
export type CompareRow = { row: string; keysready: Cell; tekmetric: Cell; shopmonkey: Cell; autoleap: Cell };

export const comparison: CompareRow[] = [
  { row: "Starting price", keysready: "$0 (Pro $29/mo)", tekmetric: "$199/mo", shopmonkey: "$239/mo", autoleap: "$199/mo" },
  { row: "Free plan", keysready: true, tekmetric: false, shopmonkey: false, autoleap: false },
  { row: "Open source, self-host", keysready: true, tekmetric: false, shopmonkey: false, autoleap: false },
  { row: "Online booking on the entry plan", keysready: true, tekmetric: "Add-on", shopmonkey: "Not described", autoleap: "Add-on" },
  { row: "Two-way messages on the entry plan", keysready: true, tekmetric: "From $439/mo", shopmonkey: true, autoleap: "From $349/mo" },
  { row: "Estimate approval and pay by phone", keysready: true, tekmetric: true, shopmonkey: true, autoleap: true },
  { row: "Repair orders, parts and inventory", keysready: false, tekmetric: true, shopmonkey: true, autoleap: true },
  { row: "Digital vehicle inspections", keysready: false, tekmetric: true, shopmonkey: true, autoleap: true },
];

export const faqs = [
  {
    q: "Is KeysReady available today?",
    a: "Not for your shop yet. A working prototype runs booking, live status, messages, estimates and card payment for one demo shop. The first release adds signup so any shop can use it. Join the waitlist on n8builds.dev to hear when it opens.",
  },
  {
    q: "Is this shop management software?",
    a: "No. KeysReady does not do repair orders, labor guides, parts, inventory or inspections. It is the customer-facing part: booking, status, messages, estimates and payment. It works next to paper tickets, a spreadsheet or the shop software you already use.",
  },
  {
    q: "Do my customers need to download an app?",
    a: "No. Every update works from a link and an email. Customers can turn on notifications in their browser if they want them. On iPhone, notifications need the page added to the home screen first, which is why email is the default.",
  },
  {
    q: "What does free actually include?",
    a: "The planned free plan covers one shop and one staff seat with unlimited bookings, status pages, email and push updates, messages, estimates and pay by phone. Card payments cost Stripe's standard fees, and KeysReady adds no fee during the beta.",
  },
  {
    q: "Why is it free?",
    a: "Email and browser notifications cost almost nothing to send, so a free plan is sustainable. Pro pays for text messages, which do cost money, plus reminders, reviews and more staff.",
  },
  {
    q: "Where does the money from customers go?",
    a: "To your own Stripe account. You are the merchant, KeysReady never holds your money and never stores card numbers.",
  },
  {
    q: "Can I host it myself?",
    a: "Yes. The code is open source under the MIT License, and the packaged self-host release comes before the hosted beta. You bring your own server, database, email provider and Stripe account.",
  },
  {
    q: "Are the prices final?",
    a: "No. Pricing is planned and may change before the hosted beta. Nothing is billable today.",
  },
] as const;
