'use strict';

/**
 * providers/twilioSms.js
 * ----------------------
 * Real Twilio SMS provider.
 *
 * IMPORTANT: `twilio` is required LAZILY (inside the constructor / inside the
 * signature helper) so that this file can be `require`d even when the `twilio`
 * npm package is not installed. The pure-Node demo never touches these code
 * paths, so it never triggers the lazy require.
 *
 * Config comes from the environment:
 *   TWILIO_ACCOUNT_SID         (required)
 *   TWILIO_AUTH_TOKEN          (required, also used to verify webhooks)
 *   TWILIO_MESSAGING_SERVICE_SID  (preferred sender)  OR
 *   TWILIO_FROM_NUMBER         (fallback sender, E.164)
 *   TWILIO_STATUS_CALLBACK_URL (optional; per-message delivery callbacks)
 */

const crypto = require('crypto');
const { NotificationProvider } = require('../provider');

class TwilioSmsProvider extends NotificationProvider {
  /**
   * @param {Object} [env] - defaults to process.env (injectable for tests)
   */
  constructor(env = process.env) {
    super('twilio-sms', ['sms']);

    this.accountSid = env.TWILIO_ACCOUNT_SID;
    this.authToken = env.TWILIO_AUTH_TOKEN;
    this.messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
    this.fromNumber = env.TWILIO_FROM_NUMBER;
    this.statusCallbackUrl = env.TWILIO_STATUS_CALLBACK_URL;

    if (!this.accountSid || !this.authToken) {
      throw new Error(
        'TwilioSmsProvider requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN'
      );
    }
    if (!this.messagingServiceSid && !this.fromNumber) {
      throw new Error(
        'TwilioSmsProvider requires TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER'
      );
    }

    // Lazy require: only pulled in when the real provider is actually used.
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    this._client = twilio(this.accountSid, this.authToken);
  }

  /**
   * @param {import('../provider').OutboundMessage} message
   * @returns {Promise<import('../provider').SendResult>}
   */
  async send(message) {
    if (message.channel !== 'sms') {
      throw new Error(`TwilioSmsProvider cannot send channel '${message.channel}'`);
    }

    const params = {
      to: message.to,
      body: message.body,
    };
    // Prefer a Messaging Service (handles number pools, opt-out, compliance);
    // fall back to an explicit from-number.
    if (this.messagingServiceSid) {
      params.messagingServiceSid = this.messagingServiceSid;
    } else {
      params.from = this.fromNumber;
    }
    const statusCallback = message.statusCallbackUrl || this.statusCallbackUrl;
    if (statusCallback) params.statusCallback = statusCallback;

    try {
      const res = await this._client.messages.create(params);
      return {
        ok: true,
        providerId: res.sid,
        status: res.status || 'queued',
        provider: this.name,
        raw: res,
      };
    } catch (err) {
      // Surface a consistent shape; mark retryable for 5xx / network errors.
      const e = new Error(`Twilio send failed: ${err.message}`);
      e.transient = !err.status || err.status >= 500;
      e.cause = err;
      throw e;
    }
  }
}

/**
 * Verify the authenticity of an incoming Twilio webhook request.
 *
 * Primary path: use twilio's official `validateRequest` (lazy-required).
 * Fallback path: if the twilio package is unavailable, compute the same
 * HMAC-SHA1 signature Twilio uses, manually:
 *   signature = base64( HMAC-SHA1( authToken, url + sortedConcat(params) ) )
 * where sortedConcat is each POST param key+value concatenated in
 * lexicographic key order, appended to the full request URL.
 *
 * @param {string} authToken - your Twilio auth token
 * @param {string} signature - value of the 'X-Twilio-Signature' header
 * @param {string} url       - the full URL Twilio requested (incl. query)
 * @param {object} params    - the POST body params (form-encoded fields)
 * @returns {boolean}
 */
function verifyTwilioSignature(authToken, signature, url, params) {
  if (!authToken || !signature || !url) return false;

  // Preferred: official validator (handles edge cases like GET/query params).
  try {
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    if (twilio && twilio.validateRequest) {
      return twilio.validateRequest(authToken, signature, url, params || {});
    }
  } catch (_e) {
    // twilio not installed — fall through to the crypto implementation.
  }

  // Fallback: replicate Twilio's signing algorithm with Node crypto.
  const sorted = Object.keys(params || {}).sort();
  let data = url;
  for (const key of sorted) {
    data += key + String(params[key]);
  }
  const expected = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  // Constant-time comparison to avoid timing leaks.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { TwilioSmsProvider, verifyTwilioSignature };
