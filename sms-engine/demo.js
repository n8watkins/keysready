'use strict';

/**
 * demo.js
 * -------
 * A fully runnable, ZERO-INSTALL demonstration of the notification engine.
 *
 *   node server/src/notifications/demo.js
 *
 * It uses only the SimulationProvider (a fake carrier + fake push service), so
 * no Twilio/web-push packages and no credentials are needed.
 *
 * What it demonstrates, end to end:
 *   1. Customer opts in (booking-form consent).
 *   2. A booking walks PENDING -> CONFIRMED -> IN_PROGRESS -> READY -> COMPLETED,
 *      enqueuing one SMS per transition; each is rendered + "sent".
 *   3. One message is DEFERRED by quiet hours (we force an out-of-window send).
 *   4. The customer texts 'STOP' -> opt-out is recorded, an auto-reply is sent,
 *      and a subsequent status update is BLOCKED (not opted in).
 *   5. The customer texts 'START' -> re-subscribe, then a send succeeds again.
 *
 * Finally it prints a readable transcript of every sent / deferred / blocked /
 * auto-reply / opt-out event so the behavior is verifiable at a glance.
 */

const { createNotificationEngine } = require('./engine');
const quietHours = require('./quietHours');

// ── tiny console helpers (no deps) ──────────────────────────────────────────
const line = (c = '─') => c.repeat(72);
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log(line('='));
  log(' AUTO-SHOP NOTIFICATION ENGINE — SIMULATION DEMO (pure Node)');
  log(line('='));

  // The shop and the customer.
  const shopId = 'shop_quickfix_austin';
  const customer = {
    firstName: 'Maria',
    phone: '+15125550147',
    timezone: 'America/Chicago', // Austin, TX
  };
  const booking = {
    id: 'bk_8842',
    ref: 'QF-8842',
    vehicle: '2018 Honda Civic',
    etaDate: 'Fri Jun 20, 3:00 PM',
  };

  // Build the engine. forceSimulation guarantees the fake providers even if the
  // environment happens to have creds. We also capture a live event feed.
  const events = [];
  const engine = createNotificationEngine({
    forceSimulation: true,
    shopName: 'QuickFix Auto Austin',
    onLog: (e) => events.push(e),
  });
  const sim = engine.simulation;

  // ── 1. CONSENT: customer checks the SMS box on the booking form ───────────
  log('\n[1] Customer opts in via the booking form.');
  engine.optIn(shopId, customer.phone, {
    source: 'booking_form',
    useCase: 'transactional_booking_updates',
    text: 'Checkbox: "Text me appointment updates"',
  });
  log(`    opted-in = ${engine.isOptedIn(shopId, customer.phone)}`);

  // ── 2. STATUS WALK: PENDING -> CONFIRMED -> IN_PROGRESS -> READY -> COMPLETED
  log('\n[2] Booking moves through its lifecycle (one SMS per transition).');
  const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'COMPLETED'];
  for (const status of statuses) {
    engine.notifyBookingStatusChange({ shopId, customer, booking, status });
    log(`    enqueued ${status}`);
  }
  await engine.dispatcher.onIdle();

  // ── 3. QUIET HOURS: force one message outside the allowed window ──────────
  // We compute a window that EXCLUDES "now" in the customer's tz so the defer
  // path is deterministic regardless of the real wall-clock time when you run
  // this. (We temporarily tighten the dispatcher's quiet-hours config.)
  log('\n[3] A status update arrives during QUIET HOURS -> it is DEFERRED.');
  const now = new Date();
  const { hour } = quietHours.localParts(now, customer.timezone);
  // Build a 1-hour "allowed" window that does NOT contain the current hour,
  // so any send right now is outside the window and must defer.
  const startHour = (hour + 2) % 24;
  const endHour = (startHour + 1) % 24;
  engine.dispatcher.quietHoursOptions = { startHour, endHour };
  log(
    `    (customer local hour is ~${hour}:00; allowed window set to ` +
      `${startHour}:00-${endHour}:00 so this send is out-of-window)`
  );
  engine.notifyBookingStatusChange({
    shopId,
    customer,
    booking,
    status: 'IN_PROGRESS',
  });
  await engine.dispatcher.onIdle();
  // Restore normal hours so later sends go through.
  engine.dispatcher.quietHoursOptions = {};

  // ── 4. INBOUND 'STOP': opt-out + auto-reply, then a blocked send ──────────
  log("\n[4] Customer texts 'STOP'. Engine records opt-out and auto-replies.");
  await sim.simulateInboundSms({ shopId, from: customer.phone, body: 'STOP' });
  await engine.dispatcher.onIdle();
  log(`    opted-in after STOP = ${engine.isOptedIn(shopId, customer.phone)}`);

  log('\n    Shop tries to send another update -> it should be BLOCKED.');
  engine.notifyBookingStatusChange({
    shopId,
    customer,
    booking,
    status: 'COMPLETED',
  });
  await engine.dispatcher.onIdle();

  // ── 5. INBOUND 'START': re-subscribe, then a send succeeds again ──────────
  log("\n[5] Customer texts 'START'. Engine re-subscribes and auto-replies.");
  await sim.simulateInboundSms({ shopId, from: customer.phone, body: 'START' });
  await engine.dispatcher.onIdle();
  log(`    opted-in after START = ${engine.isOptedIn(shopId, customer.phone)}`);

  log('\n    Shop sends a final update -> it should now SUCCEED.');
  engine.notifyBookingStatusChange({
    shopId,
    customer,
    booking,
    status: 'READY',
  });
  await engine.dispatcher.onIdle();

  // Give any deferred job's timer a brief beat (it won't fire today; that's the
  // point — it is parked until the next 8am window).
  await sleep(50);
  engine.stop();

  // ── TRANSCRIPT ────────────────────────────────────────────────────────────
  printTranscript(events, sim);
}

function badge(event) {
  return (
    {
      sent: 'SENT     ',
      deferred: 'DEFERRED ',
      blocked: 'BLOCKED  ',
      retry: 'RETRY    ',
      failed: 'FAILED   ',
    }[event] || event.toUpperCase().padEnd(9)
  );
}

function printTranscript(events, sim) {
  console.log('\n' + line('='));
  console.log(' EVENT TRANSCRIPT');
  console.log(line('='));

  for (const e of events) {
    const tag = badge(e.event);
    if (e.event === 'sent') {
      const kind = e.isAutoReply ? '[auto-reply]' : `[${e.status || 'msg'}]`;
      console.log(`${tag} ${kind} -> ${e.to}`);
      console.log(`          "${e.body}"`);
    } else if (e.event === 'deferred') {
      console.log(
        `${tag} [${e.status}] -> ${e.to}  (quiet hours; parked until ` +
          `${e.deferredUntil})`
      );
    } else if (e.event === 'blocked') {
      console.log(
        `${tag} [${e.status}] -> ${e.to}  (reason: ${e.reason})`
      );
    } else if (e.event === 'retry') {
      console.log(
        `${tag} attempt ${e.attempt} in ${e.delayMs}ms (${e.error})`
      );
    } else if (e.event === 'failed') {
      console.log(`${tag} (${e.reason}) ${e.error || ''}`);
    } else {
      console.log(`${tag} ${JSON.stringify(e)}`);
    }
  }

  // ── Summary counts ──────────────────────────────────────────────────────
  const count = (ev) => events.filter((e) => e.event === ev).length;
  console.log('\n' + line('─'));
  console.log(' SUMMARY');
  console.log(line('─'));
  console.log(`   sent ........ ${count('sent')}`);
  console.log(`   deferred .... ${count('deferred')}`);
  console.log(`   blocked ..... ${count('blocked')}`);
  console.log(`   retries ..... ${count('retry')}`);
  console.log(`   failed ...... ${count('failed')}`);
  console.log(
    `   sim carrier accepted ${sim.sentLog.length} message(s); ` +
      `${sim.inboundLog.length} inbound text(s) processed.`
  );

  console.log('\n' + line('='));
  console.log(' DEMO COMPLETE — engine handled consent, quiet hours, opt-out,');
  console.log(' re-subscribe, and two-way replies with zero external deps.');
  console.log(line('='));
}

main().catch((err) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
