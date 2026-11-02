'use strict';

/**
 * quietHours.js
 * -------------
 * Quiet-hours enforcement for outbound SMS.
 *
 * Most carriers / TCPA guidance restrict marketing texts to 8:00am–9:00pm in
 * the RECIPIENT's local time. Some states are stricter — Texas, for example, is
 * commonly treated as 9:00am–9:00pm. Transactional booking updates have more
 * latitude, but we default to the conservative 8–21 window and make it
 * configurable per call.
 *
 * Pure Node: timezone math is done with the built-in `Intl.DateTimeFormat`
 * (IANA timezones), so there is no moment-timezone / luxon dependency.
 *
 * NOTE on STOP/HELP auto-replies: those are exempt from quiet hours (you must
 * always answer them). The Dispatcher handles that exemption, not this module.
 */

const DEFAULT_START_HOUR = 8;   // 8:00am local
const DEFAULT_END_HOUR = 21;    // 9:00pm local (exclusive upper bound)

// Convenience presets you can spread into options.
const PRESETS = {
  DEFAULT: { startHour: 8, endHour: 21 }, // 8am–9pm
  TX: { startHour: 9, endHour: 21 },      // Texas: 9am–9pm
};

/**
 * Get the wall-clock hour/minute in a given IANA timezone for an instant.
 * @param {Date} date
 * @param {string} timezone - IANA tz, e.g. 'America/Chicago'
 * @returns {{ hour:number, minute:number, weekday:string }}
 */
function localParts(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  let hour = parseInt(get('hour'), 10);
  // Intl can emit '24' for midnight in hour12:false on some runtimes.
  if (hour === 24) hour = 0;
  return {
    hour,
    minute: parseInt(get('minute'), 10),
    weekday: get('weekday'),
  };
}

/**
 * Compute the UTC offset (in minutes) for a timezone at a given instant.
 * Used to construct a UTC Date for a desired local wall-clock time.
 * @param {Date} date
 * @param {string} timezone
 * @returns {number} offset minutes (e.g. America/Chicago in summer => -300)
 */
function tzOffsetMinutes(date, timezone) {
  // Format the instant as if it were in the target tz, parse back to a Date
  // treated as UTC, and diff against the real instant.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  let hh = map.hour === '24' ? '00' : map.hour;
  const asUTC = Date.UTC(
    +map.year, +map.month - 1, +map.day, +hh, +map.minute, +map.second
  );
  return (asUTC - date.getTime()) / 60000;
}

/**
 * Is `date` within the allowed sending window for the recipient's timezone?
 * @param {Date} date
 * @param {string} timezone - IANA tz
 * @param {Object} [opts]
 * @param {number} [opts.startHour=8]
 * @param {number} [opts.endHour=21]
 * @returns {boolean} true if it's OK to send right now
 */
function isWithinQuietHours(date, timezone, opts = {}) {
  // (Name reads "isWithin*quiet*Hours" but returns true when SENDING IS ALLOWED,
  //  i.e. when we are within the *allowed* window — kept per the spec's signature.)
  const startHour = opts.startHour ?? DEFAULT_START_HOUR;
  const endHour = opts.endHour ?? DEFAULT_END_HOUR;
  const { hour } = localParts(date, timezone);
  return hour >= startHour && hour < endHour;
}

/**
 * Given an instant outside the window, return the next instant that falls at
 * `startHour` local time (today if still before the window, else tomorrow).
 * If already inside the window, returns `date` unchanged.
 *
 * @param {Date} date
 * @param {string} timezone
 * @param {Object} [opts]
 * @param {number} [opts.startHour=8]
 * @param {number} [opts.endHour=21]
 * @returns {Date} the next sendable instant (UTC Date)
 */
function nextSendableTime(date, timezone, opts = {}) {
  const startHour = opts.startHour ?? DEFAULT_START_HOUR;
  const endHour = opts.endHour ?? DEFAULT_END_HOUR;

  if (isWithinQuietHours(date, timezone, { startHour, endHour })) {
    return date;
  }

  const { hour } = localParts(date, timezone);

  // Determine the target local DAY: if we're past the window (>= endHour),
  // target tomorrow's start; if before the window (< startHour), target today.
  const dayShift = hour >= endHour ? 1 : 0;

  // Build the local Y/M/D for the target day using the tz's calendar.
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const base = new Date(date.getTime() + dayShift * 24 * 60 * 60 * 1000);
  const [y, m, d] = dayFmt.format(base).split('-').map(Number);

  // We want startHour:00 local on (y,m,d). Convert that local wall-clock to UTC
  // using the tz offset at roughly that moment.
  // First guess: treat startHour local as UTC, then correct by the offset.
  const guessUTC = Date.UTC(y, m - 1, d, startHour, 0, 0);
  const offset = tzOffsetMinutes(new Date(guessUTC), timezone);
  const targetUTC = guessUTC - offset * 60000;
  return new Date(targetUTC);
}

module.exports = {
  isWithinQuietHours,
  nextSendableTime,
  localParts,
  PRESETS,
  DEFAULT_START_HOUR,
  DEFAULT_END_HOUR,
};
