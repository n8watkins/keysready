# Owner to-do

Things only the owner can do for KeysReady: keys, accounts and decisions.
Agents keep this list current; tick an item by changing `[ ]` to `[x]` and adding the date.
No secrets go in this file: keys live in pass-env (entries `keysready/<NAME>`) and in Vercel, and this file names only the entries.
The cross-project list of keys to rotate is `SECURITY-TODO.md` in the private [secret-handling-review](https://github.com/n8watkins/secret-handling-review/blob/main/SECURITY-TODO.md) repo.

Last checked: 2026-11-02.
For reference: the demo shop's staff login (`DEMO_STAFF_EMAIL` and `DEMO_STAFF_PASSWORD`) is in `web/.env.local`, and in Vercel production for the demo at https://keysready.vercel.app.

## 1. Rotate the five keys that were pasted into a chat

- [ ] Brevo, Resend, Turso, Stripe (test) and the Vercel token are rotated, updated and stored in pass-env.

**What.**
Replace five keys that were pasted into an earlier agent chat and were never rotated.
They are listed in section 6 of the old handoff (`docs/HANDOFF.md` in the read-only [keysready-archive](https://github.com/n8watkins/keysready-archive) repo).

**Steps.**
For each key: create the new one, store it in pass-env in your own terminal, send it to Vercel production, update `web/.env.local`, then delete or revoke the old one.

| Key | Where to rotate | pass-env entry |
| --- | --- | --- |
| `BREVO_API_KEY` | Brevo, SMTP and API, API keys | `keysready/BREVO_API_KEY` |
| `RESEND_API_KEY` | Resend, API Keys | `keysready/RESEND_API_KEY` |
| `DATABASE_AUTH_TOKEN` | Turso: `turso db tokens create <database>`, then `turso db tokens invalidate <database>` for the old ones | `keysready/DATABASE_AUTH_TOKEN` |
| `STRIPE_SECRET_KEY` (test mode) | Stripe, test mode, Developers, API keys, Roll key | `keysready/STRIPE_SECRET_KEY` |
| The Vercel access token | Vercel, Account Settings, Tokens: delete it and create a new one only if something still needs it | `machine/VERCEL_TOKEN` (only if kept) |

From the `web/` folder, for each of the first four:

```sh
pass-env set keysready/<NAME>
pass-env pipe keysready/<NAME> -- vercel env add <NAME> production   # after `vercel env rm <NAME> production`
```

Then redeploy (`vercel deploy --prod --yes` from `web/`, or ask Claude) and check a sign-in email and a test payment on https://keysready.vercel.app.
Ask Claude to switch `web/.env.local` to a `.env.pass` file afterwards, so the local copies go away (the e2e script reads `.env.local` directly and needs a small change first).

**Why.**
Anything pasted into a chat stays in the agent logs, so these keys must be treated as exposed even though they are test or scoped keys.

**Unblocks.**
Closes the KeysReady entries in SECURITY-TODO.md, and lets `pass-env scrub --fix` blank the old copies in the logs.

## 2. Decide: next/image for the four marketing images

- [ ] Decision given to Claude.

**What.**
The landing page (`web/app/(marketing)/page.tsx`) uses four plain `<img>` elements, which Next.js's lint flags (`@next/next/no-img-element`).

**Steps.**
Tell Claude one of:

1. Switch them to `next/image` (automatic resizing and modern formats, so faster loads; it uses Vercel's image optimization, which has a free monthly allowance).
2. Keep `<img>` on purpose and silence the warning for those lines.

**Why.**
It is a speed and cost trade-off on a public page, so it is your call.

**Unblocks.**
A lint run with no warnings.

## 3. Delete the old Firebase project, if it still exists

- [ ] Checked, and deleted if found.

**What.**
The original 2025 prototype used a Firebase project, `auto-repair-demo`; the app no longer uses Firebase at all.

**Steps.**

1. Open https://console.firebase.google.com with each of your Google accounts and look for `auto-repair-demo`.
2. If you find it: Project settings, General, Delete project.

**Why.**
An unused project can still hold old data and keys; Claude's Firebase login does not see it, so it may be under another Google account.

**Unblocks.**
Nothing new; it removes a forgotten resource.
