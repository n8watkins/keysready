import { NextResponse } from "next/server";
import { clearDriverCookie } from "@/lib/driver-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearDriverCookie();
  return NextResponse.json({ ok: true });
}
