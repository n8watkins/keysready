export type Tier = {
  name: string;
  price: string;
  cadence: string;
  highlight?: boolean;
  blurb: string;
  features: string[];
  cta: string;
};

/** Single source of truth for plans — used by the home page and /pricing. */
export const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    highlight: true,
    blurb: "Unlimited web push. Everything a small shop needs to stop phone tag.",
    features: [
      "Unlimited push (staff + customers)",
      "Booking page + customer status tracking",
      "Installable PWA (Add to Home Screen)",
      "1 shop, 1 user",
    ],
    cta: "Start free",
  },
  {
    name: "Starter",
    price: "$39",
    cadence: "/mo",
    blurb: "Reach the customers who don’t install the app — over SMS.",
    features: [
      "Everything in Free",
      "SMS updates (~750 texts/mo)",
      "Done-for-you 10DLC registration",
      "Appointment reminders + templates",
      "Up to 3 users",
    ],
    cta: "Choose Starter",
  },
  {
    name: "Pro",
    price: "$99",
    cadence: "/mo",
    blurb: "More volume, marketing, and a full team.",
    features: [
      "Everything in Starter",
      "~2,000 SMS segments/mo",
      "Marketing + review requests",
      "Up to 8 users + analytics",
    ],
    cta: "Choose Pro",
  },
];

export const MULTI_LOCATION_NOTE = "Multi-location? Multi-Shop is $149/location.";
