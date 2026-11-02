import { NextResponse } from "next/server";
import { requireDriver, isDriverUnauthorized } from "@/lib/driver-auth";
import { deleteCar } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DELETE /api/driver/cars/:id -> { ok: true }; 404 if not the driver's car.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let driverId: string;
  try {
    driverId = (await requireDriver()).driverId;
  } catch (err) {
    if (isDriverUnauthorized(err)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;

  try {
    // deleteCar is scoped by driver_id, so a car belonging to someone else (or a
    // nonexistent id) deletes 0 rows -> 404. No cross-driver information leak.
    const removed = await deleteCar(id, driverId);
    if (!removed) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}
