import { NextResponse } from "next/server";
import { requireDriver, isDriverUnauthorized } from "@/lib/driver-auth";
import { getDriverById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/driver/me -> { driver: { id, email, name, phone } } | 401
export async function GET() {
  let driverId: string;
  let email: string;
  try {
    const session = await requireDriver();
    driverId = session.driverId;
    email = session.email;
  } catch (err) {
    if (isDriverUnauthorized(err)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  try {
    const driver = await getDriverById(driverId);
    // The cookie is valid but the row is gone (e.g. wiped DB) — treat as 401.
    if (!driver) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
      driver: {
        id: driver.id,
        email: driver.email ?? email,
        name: driver.name ?? null,
        phone: driver.phone ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}
