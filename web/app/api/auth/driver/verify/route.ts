import { NextResponse } from "next/server";
import { consumeMagicToken, findOrCreateDriver } from "@/lib/store";
import {
  createDriverSession,
  driverSessionExpiry,
  setDriverCookie,
  type DriverSessionPayload,
} from "@/lib/driver-auth";
import { canonicalOrigin } from "@/lib/app-url";

export const dynamic = "force-dynamic";

// Build an absolute redirect URL on the TRUSTED canonical origin. `path` is
// always an internal, hardcoded path; resolving it against the canonical origin
// (not a forgeable Host header) prevents an open-redirect off-site.
function redirectTo(req: Request, path: string): URL {
  return new URL(path, canonicalOrigin(req));
}

// GET /api/auth/driver/verify?token=ID
// Consume the token (single-use), find-or-create the driver, set the driver
// cookie, and redirect into the driver app. Any failure (missing/used/expired/
// DB error) redirects to the login page with ?error=expired — we never explain
// which failure happened.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");

  const fail = () =>
    NextResponse.redirect(redirectTo(req, "/driver/login?error=expired"), { status: 302 });

  if (!token) return fail();

  let email: string | undefined;
  try {
    email = await consumeMagicToken(token);
  } catch (err) {
    console.error("[auth:driver:verify] consume failed:", err);
    return fail();
  }
  if (!email) return fail();

  let driverId: string;
  try {
    const driver = await findOrCreateDriver(email);
    driverId = driver.id;
  } catch (err) {
    console.error("[auth:driver:verify] driver upsert failed:", err);
    return fail();
  }

  const payload: DriverSessionPayload = {
    driverId,
    email,
    role: "driver",
    exp: driverSessionExpiry(),
  };
  // Set the cookie via the cookie store; Next applies the Set-Cookie header to
  // this handler's response (including the redirect) automatically.
  await setDriverCookie(createDriverSession(payload));

  return NextResponse.redirect(redirectTo(req, "/driver"), { status: 302 });
}
