// Payments abstraction with a DEMO (sim) fallback so the whole money flow works
// WITHOUT a Stripe account. When STRIPE_SECRET_KEY is set we create a real Stripe
// Checkout Session; otherwise createCheckout returns { mode: 'sim' } and the
// driver UI marks the booking paid via /api/driver/pay/confirm.
//
// `stripe` is loaded lazily (require) so the package is only touched when keys
// are configured — the app builds and runs with no Stripe dependency installed.
//
// All amounts are INTEGER CENTS end to end.

export interface CheckoutItem {
  description: string;
  amount_cents: number;
}

export interface CreateCheckoutInput {
  bookingRef: string;
  items: CheckoutItem[];
  totalCents: number;
  successUrl: string;
  cancelUrl: string;
}

export type CheckoutResult =
  | { mode: "stripe"; url: string | null; sessionId: string }
  | { mode: "sim" };

/** True when a real Stripe secret key is configured. */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

// Lazily instantiate the Stripe SDK only when configured. Kept out of module
// scope so importing this file never requires the `stripe` package.
function getStripe(): {
  checkout: {
    sessions: {
      create: (
        params: unknown,
        options?: { idempotencyKey?: string },
      ) => Promise<{ id: string; url: string | null }>;
    };
  };
  webhooks: {
    constructEventAsync: (body: string | Buffer, sig: string, secret: string) => Promise<StripeEvent>;
  };
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Stripe = require("stripe");
  // The fetch client works on Node and on Cloudflare Workers, where the SDK's
  // default node:https client never completes a request.
  return new Stripe(process.env.STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });
}

// The Stripe Checkout Session fields the webhook needs to verify before trusting
// a 'checkout.session.completed' event. All amounts are INTEGER CENTS.
export interface StripeCheckoutSession {
  id?: string;
  payment_status?: string | null;
  currency?: string | null;
  amount_total?: number | null;
  metadata?: { bookingRef?: string } | null;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
}

/**
 * Create a checkout for a booking's approved quote.
 * - Stripe configured -> a Checkout Session (mode 'payment', usd), line items
 *   mapped from cents, success/cancel URLs, metadata.bookingRef -> { mode:'stripe', url }.
 * - Otherwise -> { mode:'sim' } (the demo Pay button confirms payment directly).
 */
export async function createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
  if (!isStripeConfigured()) {
    return { mode: "sim" };
  }
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: input.items.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.description },
          unit_amount: item.amount_cents,
        },
        quantity: 1,
      })),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { bookingRef: input.bookingRef },
    },
    // Idempotency key: repeated Pay clicks for the same booking+total return the
    // SAME Checkout Session instead of creating duplicate sessions/charges.
    { idempotencyKey: `pay_${input.bookingRef}_${input.totalCents}` },
  );
  return { mode: "stripe", url: session.url, sessionId: session.id };
}

/**
 * Verify and parse a Stripe webhook payload against the raw request body and the
 * 'stripe-signature' header, using STRIPE_WEBHOOK_SECRET. Only meaningful when
 * Stripe is configured. Async because on Cloudflare Workers Stripe signs with
 * Web Crypto, which has no synchronous API.
 */
export async function verifyStripeWebhook(rawBody: string | Buffer, sig: string): Promise<StripeEvent> {
  const stripe = getStripe();
  return stripe.webhooks.constructEventAsync(
    rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET as string,
  );
}
