'use strict';

/**
 * consent.js
 * ----------
 * Consent / opt-in tracking for SMS (A2P 10DLC compliance lives or dies here).
 *
 * Carriers and the TCPA require that you (a) only message people who opted in,
 * (b) honor STOP/UNSUBSCRIBE immediately, and (c) answer HELP. This store keeps
 * the consent state and an audit trail, and classifies inbound keywords.
 *
 * In-memory only (a Map keyed by `${shopId}::${phone}`). In production this
 * maps to a database table; the public API is intentionally small so it can be
 * swapped without touching callers.
 */

// Canonical SMS opt-out / help / opt-in keywords (carrier standard set).
const OPT_OUT_KEYWORDS = new Set([
  'STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT', 'REVOKE',
]);
const HELP_KEYWORDS = new Set(['HELP', 'INFO']);
const OPT_IN_KEYWORDS = new Set(['START', 'UNSTOP', 'YES']);

/**
 * @typedef {Object} ConsentRecord
 * @property {string} source     - where consent came from (e.g. 'booking_form', 'sms_keyword')
 * @property {string} useCase    - what they consented to (e.g. 'transactional_booking_updates')
 * @property {string} capturedAt - ISO timestamp
 * @property {string} [text]     - verbatim text (the keyword or form checkbox label)
 * @property {'opt_in'|'opt_out'} action
 */

/**
 * @typedef {Object} ConsentState
 * @property {boolean} optedIn
 * @property {string}  shopId
 * @property {string}  phone
 * @property {ConsentRecord[]} history
 * @property {string}  updatedAt
 */

function normalizePhone(phone) {
  // Normalize to canonical E.164 so opt-in capture (which may use a formatted
  // number like '512-555-0147') and Twilio's inbound 'From' (already E.164,
  // e.g. '+15125550147') key to the SAME record. Without this, a STOP from
  // Twilio could miss a consent record stored under a formatted number.
  //
  // Strip everything that is not a digit; if we end up with 10 digits assume a
  // North American number and prepend the country code '1'; then prefix '+'.
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const withCountry = digits.length === 10 ? `1${digits}` : digits;
  return `+${withCountry}`;
}

function key(shopId, phone) {
  return `${shopId}::${normalizePhone(phone)}`;
}

/** Classify a free-text inbound message into an intent. */
function classifyKeyword(text) {
  // Match on the first whitespace token so "STOP please" still opts out.
  const firstToken = String(text || '').trim().toUpperCase().split(/\s+/)[0];
  // Strip surrounding (and embedded) punctuation/whitespace so 'STOP.',
  // 'STOP!', '(STOP)', 'Stop.' all classify as opt_out. Carriers and the TCPA
  // require us to honor these even when the customer adds punctuation; missing
  // them is a compliance violation.
  const first = firstToken.replace(/[^A-Z]/g, '');
  if (OPT_OUT_KEYWORDS.has(first)) return 'opt_out';
  if (HELP_KEYWORDS.has(first)) return 'help';
  if (OPT_IN_KEYWORDS.has(first)) return 'opt_in';
  return 'none';
}

class ConsentStore {
  constructor() {
    /** @type {Map<string, ConsentState>} */
    this._map = new Map();
  }

  _ensure(shopId, phone) {
    const k = key(shopId, phone);
    let state = this._map.get(k);
    if (!state) {
      state = {
        shopId,
        phone: normalizePhone(phone),
        optedIn: false,
        history: [],
        updatedAt: new Date().toISOString(),
      };
      this._map.set(k, state);
    }
    return state;
  }

  /**
   * Record an opt-in with an audit record.
   * @param {string} shopId
   * @param {string} phone
   * @param {Object} [rec]
   * @param {string} [rec.source]
   * @param {string} [rec.useCase]
   * @param {string} [rec.text]
   */
  optIn(shopId, phone, rec = {}) {
    const state = this._ensure(shopId, phone);
    state.optedIn = true;
    state.updatedAt = new Date().toISOString();
    state.history.push({
      action: 'opt_in',
      source: rec.source || 'unknown',
      useCase: rec.useCase || 'transactional_booking_updates',
      text: rec.text,
      capturedAt: state.updatedAt,
    });
    return state;
  }

  /**
   * Record an opt-out with an audit record.
   * @param {string} shopId
   * @param {string} phone
   * @param {Object} [rec]
   */
  optOut(shopId, phone, rec = {}) {
    const state = this._ensure(shopId, phone);
    state.optedIn = false;
    state.updatedAt = new Date().toISOString();
    state.history.push({
      action: 'opt_out',
      source: rec.source || 'sms_keyword',
      useCase: rec.useCase || 'transactional_booking_updates',
      text: rec.text,
      capturedAt: state.updatedAt,
    });
    return state;
  }

  /**
   * @param {string} shopId
   * @param {string} phone
   * @returns {boolean}
   */
  isOptedIn(shopId, phone) {
    const state = this._map.get(key(shopId, phone));
    return !!(state && state.optedIn);
  }

  /**
   * @param {string} shopId
   * @param {string} phone
   * @returns {ConsentState | undefined}
   */
  get(shopId, phone) {
    return this._map.get(key(shopId, phone));
  }

  /**
   * Handle an inbound keyword for a phone, applying any consent change.
   * Returns the classification plus a suggested auto-reply (per carrier rules,
   * STOP and HELP MUST be auto-acknowledged).
   *
   * @param {string} shopId
   * @param {string} phone
   * @param {string} text - inbound message body
   * @param {Object} [opts]
   * @param {string} [opts.shopName] - used in HELP/STOP confirmation copy
   * @returns {{ intent:'opt_out'|'help'|'opt_in'|'none', changed:boolean, autoReply:(string|null) }}
   */
  handleKeyword(shopId, phone, text, opts = {}) {
    const intent = classifyKeyword(text);
    const shopName = opts.shopName || 'the shop';
    let changed = false;
    let autoReply = null;

    if (intent === 'opt_out') {
      const wasIn = this.isOptedIn(shopId, phone);
      this.optOut(shopId, phone, { source: 'sms_keyword', text });
      changed = wasIn;
      autoReply =
        `You have been unsubscribed from ${shopName} and will not receive ` +
        `further messages. Reply START to re-subscribe.`;
    } else if (intent === 'help') {
      autoReply =
        `${shopName} appointment updates. Msg&data rates may apply. ` +
        `Reply STOP to unsubscribe.`;
    } else if (intent === 'opt_in') {
      const wasOut = !this.isOptedIn(shopId, phone);
      this.optIn(shopId, phone, { source: 'sms_keyword', text });
      changed = wasOut;
      autoReply =
        `You're re-subscribed to ${shopName} appointment updates. ` +
        `Reply HELP for help, STOP to unsubscribe.`;
    }

    return { intent, changed, autoReply };
  }
}

module.exports = {
  ConsentStore,
  classifyKeyword,
  OPT_OUT_KEYWORDS,
  HELP_KEYWORDS,
  OPT_IN_KEYWORDS,
};
