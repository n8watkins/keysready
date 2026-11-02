// Shop-side quote/invoice management. Staff build and edit a booking's quote
// (line items in cents) then send it to the customer.
//
// AUTHZ: requireStaff, and the staff's shopId must own the booking. We resolve
// the booking shop-unscoped (getBookingWithDriverByRef) then check membership —
// returning 404 (not 403) to a non-owner so we never leak existence.
//
// All amounts are INTEGER CENTS.

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getBookingWithDriverByRef, getQuote, setQuoteItems } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DESCRIPTION = 200;
const MAX_LINE_ITEMS = 100;

// GET /api/shop/quote?ref=BK-XXXX -> the booking's quote.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ref = new URL(req.url).searchParams.get("ref")?.trim();
  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  try {
    const found = await getBookingWithDriverByRef(ref);
    if (!found || found.booking.shopId !== session.shopId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const quote = await getQuote(found.booking.ref);
    return NextResponse.json({ quote });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}

// PUT /api/shop/quote  { ref, items: [{ description, amountCents }] }
//   -> replaces the line items and saves the quote as a draft.
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: { ref?: unknown; items?: unknown };
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ref = typeof raw.ref === "string" ? raw.ref.trim() : "";
  if (!ref) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }
  if (!Array.isArray(raw.items)) {
    return NextResponse.json({ error: "items must be an array" }, { status: 400 });
  }
  if (raw.items.length > MAX_LINE_ITEMS) {
    return NextResponse.json(
      { error: `A quote can have at most ${MAX_LINE_ITEMS} line items` },
      { status: 400 },
    );
  }

  // Validate/normalize each item before touching the DB (mirrors the store).
  const items: Array<{ description: string; amountCents: number }> = [];
  for (const it of raw.items as unknown[]) {
    if (typeof it !== "object" || it === null) {
      return NextResponse.json({ error: "Each line item must be an object" }, { status: 400 });
    }
    const rec = it as { description?: unknown; amountCents?: unknown };
    const description =
      typeof rec.description === "string" ? rec.description.trim() : "";
    if (!description) {
      return NextResponse.json({ error: "Each line item needs a description" }, { status: 400 });
    }
    if (description.length > MAX_DESCRIPTION) {
      return NextResponse.json(
        { error: `Description must be at most ${MAX_DESCRIPTION} characters` },
        { status: 400 },
      );
    }
    const amountCents = Number(rec.amountCents);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      return NextResponse.json(
        { error: "Amounts must be a whole number of cents (>= 0)" },
        { status: 400 },
      );
    }
    items.push({ description, amountCents });
  }

  try {
    const found = await getBookingWithDriverByRef(ref);
    if (!found || found.booking.shopId !== session.shopId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const quote = await setQuoteItems(found.booking.ref, session.shopId, items);
    return NextResponse.json({ quote });
  } catch (e) {
    // Store errors: a frozen (already-sent) quote -> 409; validation -> 400;
    // everything else -> 503.
    const msg = e instanceof Error ? e.message : "";
    if (/no longer be edited|already sent/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (/description|cents|line items/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}
