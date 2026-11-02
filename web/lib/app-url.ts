/**
 * The canonical, TRUSTED origin used to build absolute links we hand back to
 * users (magic-link emails, post-login redirects).
 *
 * SECURITY: never derive this from attacker-controllable request headers
 * (`Host` / `X-Forwarded-Host` / `X-Forwarded-Proto`). A forged header would let
 * an attacker mint a genuine KeysReady email whose sign-in link points at their
 * own server (token theft / account takeover) and turn redirects into open
 * redirects. In production, set `APP_URL` to the canonical origin
 * (e.g. https://keysready.vercel.app). When it is unset (local dev / preview) we
 * fall back to the request URL's own origin — NOT the forwarded headers.
 */
export function canonicalOrigin(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(req.url).origin;
}
