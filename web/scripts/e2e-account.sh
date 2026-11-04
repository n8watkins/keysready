#!/usr/bin/env bash
# End-to-end test for /account (Better Auth email + password) on a FRESH database.
# Starts `next start` on a brand-new SQLite file, signs up, reads the session,
# signs out and back in, then restarts the server on the same file to prove the
# schema setup is idempotent. Needs a built app (next build) and nothing else:
# no .env.local, no network, never a remote database.
#   npm run build && npm run e2e:account
set -uo pipefail
cd "$(dirname "$0")/.."   # -> web/

PORT="${E2E_PORT:-$(( 20000 + ($$ % 20000) ))}"
B="http://localhost:$PORT"
PASS=0; FAIL=0
ok(){ echo "  PASS  $1"; PASS=$((PASS+1)); }
no(){ echo "  FAIL  $1"; FAIL=$((FAIL+1)); }
Q(){ node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const j=JSON.parse(s);console.log(eval(process.argv[1]))}catch(e){console.log('')}})" "$1"; }

TMP=$(mktemp -d)
# A real env var wins over .env.local, so this run can never reach a database
# configured there.
export DATABASE_URL="file:$TMP/account-e2e.db"
export DATABASE_AUTH_TOKEN=""
export SESSION_SECRET="${SESSION_SECRET:-e2e-only-$(node -e 'console.log(require("crypto").randomBytes(24).toString("hex"))')}"
export BETTER_AUTH_SECRET="$SESSION_SECRET"
export BETTER_AUTH_URL="$B"
export APP_URL="$B"
export SEED_DEMO_STAFF="false"
LOG="$TMP/server.log"; JAR="$TMP/cookies"

SRV=""
start_server(){
  nohup npx next start -p "$PORT" >>"$LOG" 2>&1 &
  SRV=$!
  curl -s --retry-connrefused --retry 60 --retry-delay 1 -o /dev/null "$B/api/health"
}
# `npx` forks next-server, so killing $SRV alone leaves the server listening.
stop_server(){
  [ -n "$SRV" ] && kill "$SRV" 2>/dev/null
  for pid in $(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -oP 'pid=\K[0-9]+' | sort -u); do kill "$pid" 2>/dev/null; done
  [ -n "$SRV" ] && wait "$SRV" 2>/dev/null
  SRV=""
}
cleanup(){ stop_server; [ "$FAIL" -eq 0 ] && rm -rf "$TMP" || echo "server log kept at $LOG"; }
trap cleanup EXIT

post(){ curl -s --max-time 15 -b "$JAR" -c "$JAR" -X POST "$B/api/account/$1" \
  -H 'Content-Type: application/json' -H "Origin: $B" --data "$2" -w '\n%{http_code}'; }
code(){ tail -n1 <<<"$1"; }
body(){ sed '$d' <<<"$1"; }

echo "== KeysReady /account e2e (fresh database) =="
start_server
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/account")" = "200" ] && ok "/account page loads" || no "/account page"

# Unknown paths answer a real 404 with KeysReady's own not-found page.
NF=$(curl -s --max-time 15 -w '\n%{http_code}' "$B/zz-no-such-page")
{ [ "$(code "$NF")" = "404" ] && body "$NF" | grep -q "<h1[^>]*>This page isn&#x27;t here.</h1>"; } \
  && ok "unknown path answers 404 with the not-found page" || no "unknown path: $(code "$NF")"

EMAIL="account-e2e-$(date +%s)@example.com"
PW="e2e-password-$RANDOM-$RANDOM"
R=$(post sign-up/email "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"E2E Driver\"}")
{ [ "$(code "$R")" = "200" ] && [ "$(body "$R" | Q 'j.user.email')" = "$EMAIL" ]; } \
  && ok "sign-up on a fresh database (200)" || no "sign-up: $(code "$R") $(body "$R" | head -c 200)"

S=$(curl -s --max-time 15 -b "$JAR" "$B/api/account/get-session")
[ "$(echo "$S" | Q 'j.user.email')" = "$EMAIL" ] && ok "session cookie signs the new user in" || no "get-session: $(echo "$S" | head -c 200)"

R=$(post sign-up/email "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"Again\"}")
[ "$(code "$R")" = "422" ] && ok "duplicate sign-up is rejected (422), not a crash" || no "duplicate sign-up: $(code "$R")"

R=$(post sign-out '{}')
[ "$(code "$R")" = "200" ] && ok "sign-out" || no "sign-out: $(code "$R")"

# Restart on the same file: the schema setup must be a no-op the second time.
stop_server
start_server
R=$(post sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
[ "$(code "$R")" = "200" ] && ok "sign-in after a restart on the same database" || no "sign-in after restart: $(code "$R")"
R=$(post sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"wrong-password-123\"}")
[ "$(code "$R")" = "401" ] && ok "wrong password is rejected (401)" || no "wrong password: $(code "$R")"

created=$(grep -c '\[auth\] database schema updated' "$LOG")
[ "$created" = "1" ] && ok "Better Auth tables created once, untouched on restart" || no "schema update ran $created times"
grep -q 'Database schema mismatch' "$LOG" && no "server logged a schema mismatch" || ok "no schema mismatch in the server log"

echo "== RESULT: $PASS passed, $FAIL failed =="
[ "$FAIL" -eq 0 ]
