#!/usr/bin/env bash
# End-to-end test for KeysReady V3: driver login (magic link) -> book -> shop quote ->
# driver approve -> Stripe Checkout session -> SIGNED webhook -> booking marked paid.
# Also checks auth/state-machine guards. Run from anywhere:  bash web/scripts/e2e.sh
# Requires: a built app (next build) and web/.env.local with Stripe test keys and the
# demo owner settings (+ optional VAPID).
# Database: a brand-new throwaway SQLite file per run, whatever .env.local says, so a
# run can never write to production. Set E2E_DATABASE_URL (+ E2E_DATABASE_AUTH_TOKEN)
# to test against another throwaway database on purpose.
set -uo pipefail
cd "$(dirname "$0")/.."   # -> web/

# Unique-ish port per run (derived from the shell PID) so a leftover server from a
# previous run can never cause an EADDRINUSE race. Override with E2E_PORT.
PORT="${E2E_PORT:-$(( 20000 + ($$ % 20000) ))}"
B="http://localhost:$PORT"
# Better Auth only accepts requests from its own origin.
export BETTER_AUTH_URL="$B"
PASS=0; FAIL=0
ok(){ echo "  PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
# eval a JS expr over stdin JSON (s = raw body string)
J(){ node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(eval(process.argv[1]))}catch(e){console.log('')}})" "$1"; }
Q(){ node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(eval(process.argv[1]))}catch(e){console.log('')}})" "$1"; }

# A real env var wins over .env.local (Next never overrides one), so this pins the DB.
E2E_TMP=$(mktemp -d)
export DATABASE_URL="${E2E_DATABASE_URL:-file:$E2E_TMP/e2e.db}"
export DATABASE_AUTH_TOKEN="${E2E_DATABASE_AUTH_TOKEN:-}"
echo "e2e database: ${DATABASE_URL%%\?*}" | sed -E 's#(libsql://)[^.]+#\1<db>#'

# Force the dev email fallback so the magic link is printed to the server log.
# (Next loads .env.local itself for the server; a real env var here wins over it.)
# Clear BOTH providers — Brevo takes priority over Resend, so if it's left set the
# link is actually emailed and never reaches the log for the grep below.
export BREVO_API_KEY=""
export RESEND_API_KEY=""
# Pull the Stripe secrets for webhook signing. Do NOT `source` .env.local — values like
# EMAIL_FROM ("KeysReady <noreply@...>") contain shell-special chars (< >) and break it.
export STRIPE_SECRET_KEY="$(grep -E '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2-)"
export STRIPE_WEBHOOK_SECRET="$(grep -E '^STRIPE_WEBHOOK_SECRET=' .env.local | cut -d= -f2-)"
# The shop login uses the seeded demo owner, which only exists when .env.local sets
# SEED_DEMO_STAFF=true and a strong DEMO_STAFF_PASSWORD (there is no default).
# A real env var wins over .env.local. Node builds the JSON so no value is shell-parsed.
LOGIN_BODY=$(node -e '
const fs = require("fs");
const local = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const get = (k) => process.env[k] || (local.match(new RegExp("^" + k + "=(.*)$", "m")) || [])[1] || "";
const email = get("DEMO_STAFF_EMAIL") || "demo@keysready.app";
const pass = get("DEMO_STAFF_PASSWORD");
if (!pass) process.exit(1);
console.log(JSON.stringify({ email, password: pass }));
') || { echo "e2e: set SEED_DEMO_STAFF=true and DEMO_STAFF_PASSWORD in web/.env.local first" >&2; exit 2; }

for pid in $(ss -ltnp 2>/dev/null | grep ":$PORT" | grep -oP 'pid=\K[0-9]+' | sort -u); do kill "$pid" 2>/dev/null; done
LOG=$(mktemp); JD=$(mktemp); JS=$(mktemp)   # JD=driver cookies, JS=shop cookies
nohup npx next start -p "$PORT" >"$LOG" 2>&1 &
SRV=$!
# `npx` forks next-server, so killing $SRV alone leaves the server listening.
stop_server(){
  kill "$SRV" 2>/dev/null
  for pid in $(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u); do kill "$pid" 2>/dev/null; done
  wait "$SRV" 2>/dev/null
  rm -rf "$E2E_TMP"
}
trap stop_server EXIT
curl -s --retry-connrefused --retry 60 --retry-delay 1 "$B/api/health" >/dev/null

echo "== KeysReady V3 e2e =="
H=$(curl -s --max-time 15 "$B/api/health")
[ "$(echo "$H" | Q 'j.status')" = "ok" ] && ok "server health ok ($(echo "$H" | Q 'j.db'))" || no "health: $H"

# --- /account (Better Auth) sign-up works on this database ---
ACC=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -X POST "$B/api/account/sign-up/email" -H 'Content-Type: application/json' -H "Origin: $B" --data "{\"email\":\"acct-$(date +%s)-$$@test.com\",\"password\":\"e2e-password-$RANDOM-$RANDOM\",\"name\":\"E2E\"}")
[ "$ACC" = "200" ] && ok "account sign-up (Better Auth) works" || no "account sign-up=$ACC"

# --- driver login via magic link (dev fallback prints it) ---
EMAIL="e2e-$(date +%s)@test.com"
curl -s --max-time 15 -X POST "$B/api/auth/driver/request" -H 'Content-Type: application/json' --data "{\"email\":\"$EMAIL\"}" >/dev/null
LINK=$(grep -oE "$B/api/auth/driver/verify\?token=[a-f0-9]+" "$LOG" | tail -1)
curl -s --max-time 15 -c "$JD" -o /dev/null "$LINK"
DID=$(curl -s --max-time 15 -b "$JD" "$B/api/driver/me" | Q 'j.driver.id')
[ -n "$DID" ] && ok "driver magic-link login ($DID)" || no "driver login failed"

# --- driver adds a car + books ---
CARID=$(curl -s --max-time 15 -b "$JD" -X POST "$B/api/driver/cars" -H 'Content-Type: application/json' --data '{"year":2020,"make":"Honda","model":"Civic"}' | Q 'j.car.id')
REF=$(curl -s --max-time 15 -b "$JD" -X POST "$B/api/driver/bookings" -H 'Content-Type: application/json' --data "{\"carId\":\"$CARID\",\"issue\":\"e2e\",\"preferredDate\":\"2026-09-01\",\"phone\":\"+15125550000\"}" | Q 'j.booking.ref')
[ -n "$REF" ] && ok "driver booked ($REF)" || no "booking failed"

# --- shop login + builds & sends quote ---
curl -s --max-time 15 -c "$JS" -X POST "$B/api/auth/login" -H 'Content-Type: application/json' --data "$LOGIN_BODY" >/dev/null
PUT=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JS" -X PUT "$B/api/shop/quote" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\",\"items\":[{\"description\":\"Brake pads\",\"amountCents\":12000},{\"description\":\"Labor\",\"amountCents\":8000}]}")
[ "$PUT" = "200" ] && ok "shop built quote (\$200)" || no "quote PUT=$PUT"
SEND=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JS" -X POST "$B/api/shop/quote/send" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\"}")
[ "$SEND" = "200" ] && ok "shop sent quote" || no "quote send=$SEND"

# --- a sent quote is locked: the shop can no longer rewrite line items ---
LOCK=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JS" -X PUT "$B/api/shop/quote" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\",\"items\":[{\"description\":\"sneaky\",\"amountCents\":1}]}")
[ "$LOCK" = "409" ] && ok "quote edit locked after send (409)" || no "edit-lock=$LOCK (expected 409)"

# --- authz: a driver cannot touch the shop quote endpoint ---
DRV_PUT=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JD" -X PUT "$B/api/shop/quote" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\",\"items\":[]}")
[ "$DRV_PUT" = "401" ] && ok "authz: driver blocked from shop quote (401)" || no "driver shop-quote=$DRV_PUT"

# --- driver cannot pay before approving ---
PRE=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JD" -X POST "$B/api/driver/pay" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\"}")
[ "$PRE" != "200" ] && ok "cannot pay before approval ($PRE)" || no "pay-before-approve allowed!"

# --- driver approves ---
APP=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JD" -X POST "$B/api/driver/quote/approve" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\"}")
[ "$APP" = "200" ] && ok "driver approved quote" || no "approve=$APP"

# --- sim-pay must be blocked while Stripe is configured ---
SIM=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' -b "$JD" -X POST "$B/api/driver/pay/confirm" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\"}")
[ "$SIM" = "400" ] && ok "sim-pay blocked when Stripe configured (400)" || no "sim-pay=$SIM (expected 400)"

# --- driver pays -> real Stripe Checkout session ---
PAY=$(curl -s --max-time 20 -b "$JD" -X POST "$B/api/driver/pay" -H 'Content-Type: application/json' --data "{\"ref\":\"$REF\"}")
MODE=$(echo "$PAY" | Q 'j.mode'); URL=$(echo "$PAY" | Q 'j.url||""')
{ [ "$MODE" = "stripe" ] && echo "$URL" | grep -q 'checkout.stripe.com'; } && ok "real Stripe Checkout session created" || no "pay mode=$MODE url=$URL"

# --- simulate the SIGNED checkout.session.completed webhook (hardened: verifies amount) ---
# quote total = 12000 + 8000 = 20000 cents.
mkevt(){ echo "{\"id\":\"$1\",\"object\":\"event\",\"type\":\"checkout.session.completed\",\"data\":{\"object\":{\"id\":\"cs_$1\",\"object\":\"checkout.session\",\"payment_status\":\"paid\",\"currency\":\"usd\",\"amount_total\":$2,\"metadata\":{\"bookingRef\":\"$REF\"}}}}"; }
sign(){ node -e "const s=require('stripe')(process.env.STRIPE_SECRET_KEY||'sk_test_x');process.stdout.write(s.webhooks.generateTestHeaderString({payload:process.argv[1],secret:process.env.STRIPE_WEBHOOK_SECRET}))" "$1"; }
postwh(){ curl -s --max-time 15 -o /dev/null -w '%{http_code}' -X POST "$B/api/webhooks/stripe" -H "stripe-signature: $2" -H 'Content-Type: application/json' --data "$1"; }
paidnow(){ curl -s --max-time 15 -b "$JD" "$B/api/driver/quote?ref=$REF" | Q '(j.quote||j).paymentStatus'; }

# Unique event ids per run: processed_events persists when E2E_DATABASE_URL reuses a
# database, so a FIXED id would be deduped on every later run and never mark paid.
RUN="$$_$(date +%s)"
EVT_OK=$(mkevt "evt_ok_$RUN" 20000)
# bad signature -> rejected
[ "$(postwh "$EVT_OK" 't=1,v1=deadbeef')" = "400" ] && ok "webhook rejects bad signature (400)" || no "bad-sig accepted"
# signed but WRONG amount -> ack'd (200) but must NOT mark paid
EVT_BAD=$(mkevt "evt_badamt_$RUN" 100)
WB=$(postwh "$EVT_BAD" "$(sign "$EVT_BAD")")
{ [ "$WB" = "200" ] && [ "$(paidnow)" = "unpaid" ]; } && ok "wrong-amount webhook ack'd but NOT marked paid" || no "wrong-amount: code=$WB paid=$(paidnow)"
# correct signed event -> 200 + paid
WO=$(postwh "$EVT_OK" "$(sign "$EVT_OK")")
{ [ "$WO" = "200" ] && [ "$(paidnow)" = "paid" ]; } && ok "valid webhook -> booking marked PAID" || no "valid webhook=$WO paid=$(paidnow)"
# replay the same event -> idempotent (deduped on event.id; still paid)
[ "$(postwh "$EVT_OK" "$(sign "$EVT_OK")")" = "200" ] && [ "$(paidnow)" = "paid" ] && ok "webhook replay is idempotent" || no "replay failed"

echo "== RESULT: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
