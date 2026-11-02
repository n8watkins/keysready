'use strict';

/**
 * templates.js
 * ------------
 * Per-status SMS copy for booking lifecycle updates, seeded with realistic
 * auto-shop wording. Supports {{firstName}} {{ref}} {{vehicle}} {{etaDate}}
 * interpolation via render(status, vars).
 *
 * Deliberately NO URL shorteners (bit.ly/tinyurl): carriers flag shortened
 * links as spam and they hurt A2P deliverability. Use full first-party URLs if
 * you ever add links.
 *
 * Statuses mirror the app's Booking.status values:
 *   PENDING, CONFIRMED, IN_PROGRESS, READY, COMPLETED, CANCELLED
 */

/**
 * Each template ends every message with the brand ref so the recipient knows
 * who is texting (carrier best practice for the first message in a thread).
 * Keep messages under ~320 chars (2 SMS segments) where possible.
 */
const TEMPLATES = {
  PENDING:
    'Hi {{firstName}}, we received your request for {{vehicle}} (ref {{ref}}). ' +
    "We'll confirm your appointment shortly. Reply HELP for help, STOP to opt out.",

  CONFIRMED:
    'Hi {{firstName}}, your appointment for {{vehicle}} is CONFIRMED (ref {{ref}}). ' +
    'Estimated ready: {{etaDate}}. Reply HELP for help, STOP to opt out.',

  IN_PROGRESS:
    'Update on {{vehicle}} (ref {{ref}}): our techs have started work. ' +
    "We'll text you when it's ready. Est. ready {{etaDate}}.",

  READY:
    'Good news {{firstName}}! Your {{vehicle}} is READY for pickup (ref {{ref}}). ' +
    'See you soon. Reply HELP for help, STOP to opt out.',

  COMPLETED:
    'Thanks {{firstName}}! Service on your {{vehicle}} is COMPLETE (ref {{ref}}). ' +
    'We appreciate your business — drive safe!',

  CANCELLED:
    'Hi {{firstName}}, your appointment for {{vehicle}} (ref {{ref}}) has been ' +
    'CANCELLED. Call us to reschedule. Reply HELP for help, STOP to opt out.',
};

// Variables the templates may reference (used for validation/docs).
const KNOWN_VARS = ['firstName', 'ref', 'vehicle', 'etaDate'];

/**
 * Interpolate {{var}} placeholders. Missing vars render as an empty string and
 * any double spaces left behind are collapsed so copy stays clean.
 * @param {string} template
 * @param {Object} vars
 * @returns {string}
 */
function interpolate(template, vars = {}) {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name) => {
      const v = vars[name];
      return v === undefined || v === null ? '' : String(v);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Render the message for a given booking status.
 * @param {string} status - one of the keys of TEMPLATES (case-insensitive)
 * @param {Object} vars - { firstName, ref, vehicle, etaDate }
 * @returns {string}
 * @throws if the status has no template
 */
function render(status, vars = {}) {
  const key = String(status || '').toUpperCase();
  const template = TEMPLATES[key];
  if (!template) {
    throw new Error(`No message template for status '${status}'`);
  }
  return interpolate(template, vars);
}

/** @param {string} status @returns {boolean} */
function hasTemplate(status) {
  return Object.prototype.hasOwnProperty.call(
    TEMPLATES,
    String(status || '').toUpperCase()
  );
}

module.exports = {
  TEMPLATES,
  KNOWN_VARS,
  render,
  interpolate,
  hasTemplate,
};
