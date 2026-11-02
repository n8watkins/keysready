import { NextResponse } from "next/server";
import { requireDriver, isDriverUnauthorized } from "@/lib/driver-auth";
import { addCar, listCars } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MAKE = 60;
const MAX_MODEL = 60;
const MAX_PLATE = 16;

// GET /api/driver/cars -> { cars: [{ id, year, make, model, plate }] }
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
    const cars = await listCars(driverId);
    return NextResponse.json({
      cars: cars.map((c) => ({
        id: c.id,
        year: c.year ?? null,
        make: c.make ?? null,
        model: c.model ?? null,
        plate: c.plate ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}

// POST /api/driver/cars  { year, make, model, plate? } -> { car }
export async function POST(req: Request) {
  let driverId: string;
  try {
    driverId = (await requireDriver()).driverId;
  } catch (err) {
    if (isDriverUnauthorized(err)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }

  let body: { year?: unknown; make?: unknown; model?: unknown; plate?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const year = Number(body.year);
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "year must be an integer between 1900 and 2100" },
      { status: 400 },
    );
  }

  const make = typeof body.make === "string" ? body.make.trim() : "";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!make || !model) {
    return NextResponse.json({ error: "make and model are required" }, { status: 400 });
  }
  if (make.length > MAX_MAKE || model.length > MAX_MODEL) {
    return NextResponse.json(
      { error: `make (≤${MAX_MAKE}) and model (≤${MAX_MODEL}) are too long` },
      { status: 400 },
    );
  }

  const plateRaw = typeof body.plate === "string" ? body.plate.trim() : "";
  if (plateRaw.length > MAX_PLATE) {
    return NextResponse.json(
      { error: `plate must be at most ${MAX_PLATE} characters` },
      { status: 400 },
    );
  }
  const plate = plateRaw || undefined;

  try {
    const car = await addCar({ driverId, year, make, model, plate });
    return NextResponse.json({
      car: {
        id: car.id,
        year: car.year ?? null,
        make: car.make ?? null,
        model: car.model ?? null,
        plate: car.plate ?? null,
      },
    });
  } catch {
    return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  }
}
