# Deploying the KeysReady landing page

The landing page is live at https://keysready.n8builds.dev.
It is a fully static Next.js export (`output: "export"`) served by Cloudflare Workers static assets, with no Worker script and no server routes.
The Worker is `keysready-landing` in the owner's Cloudflare account, and `wrangler.jsonc` attaches `keysready.n8builds.dev` as a Workers custom domain, so Cloudflare creates and manages the DNS record itself.
Before the first deploy (2026-11-01) the hostname had no DNS record; nothing else on the `n8builds.dev` zone was touched.
Security and cache headers live in `public/_headers`.

## Cloudflare Web Analytics

The owner wants Cloudflare Web Analytics on the n8builds.dev subdomains.
The zone injects the cookieless beacon (`static.cloudflareinsights.com/beacon.min.js`) into every HTML page at the edge, so the page code does not load it.
Never add `no-transform` to `Cache-Control` in `public/_headers`, because that stops the injection.
The privacy page must keep saying the site uses Cloudflare Web Analytics, which is cookieless, does not store IP addresses and counts visits without tracking anyone.

## Redeploy

Log in once with `npx wrangler login` (check with `npx wrangler whoami`).
From `landing/`, run `npm run lint && npm run typecheck`, then `npm run deploy`.
`npm run deploy` runs `next build` (writes `out/`) and then `wrangler deploy`, which uploads only changed assets.
To check the build locally first, run `npm run build && npm run preview` and open http://localhost:8787.
If you rebuild while `npm run preview` is running, restart the preview, because deleting `out/` leaves it serving 404s.

## Verify after a deploy

```bash
curl -sI https://keysready.n8builds.dev/ | head -1                        # 200
curl -s -A 'Mozilla/5.0 Chrome/130' -H 'Accept: text/html' --compressed https://keysready.n8builds.dev/ | grep -c cloudflareinsights   # 1: beacon injected (only for browser-like requests)
curl -sI https://keysready.n8builds.dev/opengraph-image | grep -i content-type   # image/png
curl -s https://keysready.n8builds.dev/sitemap.xml | grep -c '<loc>'      # 3
curl -s https://keysready.n8builds.dev/ | grep -o 'n8builds.dev/upcoming?interest=keysready#keysready' | wc -l
```

## Roll back

Run `npx wrangler deployments list` to see recent deployments, or `npx wrangler versions list` to see versions.
Run `npx wrangler rollback` to return to the previous version, or `npx wrangler rollback <version-id>` for a specific one.
Static assets are versioned with the Worker, so a rollback restores the old pages too.
Fix forward afterwards by reverting the commit and running `npm run deploy` again, so the repository matches what is live.

## Moving to its own domain later

Add the new hostname to `routes` in `wrangler.jsonc`, set the default URL in `lib/site.ts`, and deploy.
Keep `keysready.n8builds.dev` in `routes` for a while and redirect it once the new domain is live.

## Taking it down

Run `npx wrangler delete keysready-landing`, which also removes the custom domain and its DNS record.
