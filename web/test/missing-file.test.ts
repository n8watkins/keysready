import { describe, expect, it } from "vitest";
import { isMissingFile, missingFile } from "../worker/missing-file";

const at = (path: string, init?: RequestInit) => new Request(`https://app.keysready.n8builds.dev${path}`, init);

describe("isMissingFile", () => {
  it("lets every real route and static file through", () => {
    for (const path of [
      "/",
      "/pricing",
      "/tour",
      "/book",
      "/driver/login",
      "/api/health",
      "/api/bookings/BK-ABC234",
      "/api/driver/cars/car_0123456789abcdef0123456789abcdef",
      "/api/account/sign-in/email",
      "/api/webhooks/stripe",
      "/api/push/vapid-public-key",
      "/_next/image",
      "/opengraph-image",
      "/does-not-exist",
      "/favicon.ico",
      "/icon.svg",
      "/apple-icon.png",
      "/manifest.webmanifest",
      "/sw.js",
      "/.well-known/security.txt",
    ]) {
      expect(isMissingFile(path), path).toBe(false);
    }
  });

  it("refuses file-like paths that are not routes", () => {
    for (const path of [
      "/config.json",
      "/.s3cfg",
      "/secrets.json",
      "/www.zip",
      "/terraform.tfvars",
      "/vercel.json",
      "/.env",
      "/.git/config",
      "/wp-login.php",
      "/backup.sql",
      "/api/config.json",
      "/_next/static/chunks/gone.js",
      "/icon.png",
      "/sw.js.map",
    ]) {
      expect(isMissingFile(path), path).toBe(true);
    }
  });
});

describe("missingFile", () => {
  it("is a small, cookie-free, briefly cached 404, whatever the method", async () => {
    for (const method of ["GET", "HEAD", "POST"]) {
      const response = missingFile(at("/config.json", { method }));
      expect(response?.status).toBe(404);
      expect(response?.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(response?.headers.get("Cache-Control")).toBe("public, max-age=60, s-maxage=300");
      expect(response?.headers.get("Set-Cookie")).toBeNull();
    }
    expect(await missingFile(at("/.s3cfg"))?.text()).toBe("Not found");
  });

  it("leaves everything else to the app, including its own 404 page", () => {
    expect(missingFile(at("/nope"))).toBeNull();
    expect(missingFile(at("/icon.svg"))).toBeNull();
  });
});
