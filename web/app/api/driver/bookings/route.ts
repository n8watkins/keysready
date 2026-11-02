import { NextResponse } from "next/server";
import { requireDriver, isDriverUnauthorized } from "@/lib/driver-auth";
import {
  createBooking,
  getCar,
  getDriverById,
  listBookingsByDriver,
  updateDriverPhone,
  DEMO_SHOP_ID,
} from "@/lib/store";
import { notifyNewBooking } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ISSUE = 2000;
const MAX_PHONE = 32;

// GET /api/driver/bookings ->
//   { bookings: [{ ref, vehicle, issue, status, etaDate, preferredDate, createdAt }] }
// newest first, scoped to the signed-in driver.
export async function GET() {
  let driverId: string;
  try {
    driverId = (await requireDriver()).driverId;
  } catch (err) {
    if (isDriverUnauthorized(err)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  try {
    const bookings = await listBookingsByDriver(driverId);
    return NextResponse.json({
      bookings: bookings.map((b) => ({
        ref: b.ref,
        vehicle: b.vehicle,
        issue: b.issue,
        status: b.status,
        etaDate: b.etaDate ?? null,
        preferredDate: b.preferredDate,
        createdAt: b.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}

// POST /api/driver/bookings  { carId, issue, preferredDate, phone } -> { booking }
export async function POST(req: Request) {
  let driverId: string;
  let sessionEmail: string;
  try {
    const session = await requireDriver();
    driverId = session.driverId;
    sessionEmail = session.email;
  } catch (err) {
    if (isDriverUnauthorized(err)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  let body: {
    carId?: unknown;
    issue?: unknown;
    preferredDate?: unknown;
    phone?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const carId = typeof body.carId === "string" ? body.carId.trim() : "";
  const issue = typeof body.issue === "string" ? body.issue.trim() : "";
  const preferredDate =
    typeof body.preferredDate === "string" ? body.preferredDate.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";

  if (!carId) return NextResponse.json({ error: "carId is required" }, { status: 400 });
  if (!issue) return NextResponse.json({ error: "issue is required" }, { status: 400 });
  if (!preferredDate)
    return NextResponse.json({ error: "preferredDate is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "phone is required" }, { status: 400 });
  if (issue.length > MAX_ISSUE)
    return NextResponse.json(
      { error: `issue must be at most ${MAX_ISSUE} characters` },
      { status: 400 },
    );
  if (phone.length > MAX_PHONE)
    return NextResponse.json(
      { error: `phone must be at most ${MAX_PHONE} characters` },
      { status: 400 },
    );

  let booking;
  try {
    // The car must belong to the signed-in driver (getCar is driver-scoped).
    const car = await getCar(carId, driverId);
    if (!car) {
      return NextResponse.json({ error: "Car not found" }, { status: 404 });
    }
    const vehicle = [car.year, car.make, car.model]
      .filter((p) => p != null && String(p).trim() !== "")
      .join(" ")
      .trim();

    const driver = await getDriverById(driverId);
    const email = driver?.email ?? sessionEmail;
    // Split the driver's saved name into first/last for the booking record
    // (the staff dashboard shows first/last). Fall back to the email local-part.
    const fullName = (driver?.name ?? "").trim();
    const parts = fullName ? fullName.split(/\s+/) : [];
    const firstName = parts[0] || email.split("@")[0] || "Driver";
    const lastName = parts.slice(1).join(" ");

    booking = await createBooking(
      {
        shopId: DEMO_SHOP_ID,
        firstName,
        lastName,
        phone,
        email,
        vehicle,
        issue,
        preferredDate,
      },
      driverId,
    );

    // Persist the phone onto the driver if they didn't have one yet.
    if (driver && !driver.phone) {
      try {
        await updateDriverPhone(driverId, phone);
      } catch {
        /* non-fatal: booking already created */
      }
    }
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }

  // Awaited (not fire-and-forget): serverless would kill a detached promise.
  // A push failure must NOT fail the booking, so swallow notify errors.
  try {
    await notifyNewBooking(booking);
  } catch {
    /* push failure must not fail the booking */
  }

  return NextResponse.json({ booking }, { status: 201 });
}
