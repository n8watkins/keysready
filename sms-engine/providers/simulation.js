'use strict';

/**
 * providers/simulation.js
 * -----------------------
 * A zero-dependency provider that stands in for BOTH a carrier (SMS) and a
 * push service (Web Push). It records every "sent" message to an in-memory
 * log and can synthesize inbound replies, so the whole engine is verifiable
 * end-to-end without any credentials or network access.
 *
 * Pure Node — no external requires at all.
 *
 * It implements the same NotificationProvider contract as the real providers
 * (name, supportsChannel, send), so it is a drop-in replacement.
 *
 * Inbound simulation:
 *   - simulateInboundSms({ shopId, from, to, body }) builds a payload shaped
 *     like a Twilio inbound webhook and (if an inbound handler was wired in)
 *     invokes it, so STOP/HELP/START keyword handling can be exercised offline.
 */

const crypto = require('crypto');
const { NotificationProvider } = require('../provider');

class SimulationProvider extends NotificationProvider {
  /**
   * @param {Object} [opts]
   * @param {Channel[]} [opts.channels] - channels to claim (default both)
   * @param {(payload:object)=>any} [opts.onInbound] - optional inbound handler;
   *        called by simulateInboundSms to mimic a webhook hitting the engine.
   * @param {number} [opts.failTimes] - fail the first N sends (to demo retries)
   */
  constructor(opts = {}) {
    super('simulation', opts.channels || ['sms', 'webpush']);
    /** @type {Array<object>} every accepted outbound message */
    this.sentLog = [];
    /** @type {Array<object>} every simulated inbound message */
    this.inboundLog = [];
    /** @type {Map<string, object>} providerId -> message record */
    this._byId = new Map();
    this._onInbound = opts.onInbound || null;
    this._failTimes = opts.failTimes || 0;
    this._sendCount = 0;
  }

  /** Allow late binding of the inbound handler (engine wires this up). */
  setInboundHandler(fn) {
    this._onInbound = fn;
  }

  /**
   * Accept and "deliver" a message. Records it and returns a SendResult.
   * @param {import('../provider').OutboundMessage} message
   * @returns {Promise<import('../provider').SendResult>}
   */
  async send(message) {
    this._sendCount += 1;

    // Optionally simulate transient provider failures to exercise retries.
    if (this._sendCount <= this._failTimes) {
      const err = new Error(
        `[simulation] injected transient failure #${this._sendCount}`
      );
      err.transient = true;
      throw err;
    }

    const providerId = `SIM-${crypto.randomBytes(6).toString('hex')}`;
    const record = {
      providerId,
      channel: message.channel,
      to: message.to,
      title: message.title,
      body: message.body,
      data: message.data,
      meta: message.meta || {},
      status: 'sent',
      sentAt: new Date().toISOString(),
    };
    this.sentLog.push(record);
    this._byId.set(providerId, record);

    return {
      ok: true,
      providerId,
      status: 'sent',
      provider: this.name,
      raw: record,
    };
  }

  /**
   * Mark a previously-sent message as delivered/failed, as a real carrier
   * status callback would. Useful for tests/demo of the status webhook.
   * @param {string} providerId
   * @param {string} status - e.g. 'delivered' | 'undelivered' | 'failed'
   */
  simulateStatusCallback(providerId, status) {
    const rec = this._byId.get(providerId);
    if (rec) rec.status = status;
    return {
      MessageSid: providerId,
      MessageStatus: status,
      // shaped like a Twilio status callback body
    };
  }

  /**
   * Synthesize an inbound SMS (a customer texting back). Builds a Twilio-shaped
   * payload and, if an inbound handler is wired in, invokes it so the engine's
   * keyword/consent logic runs exactly as it would for a real webhook.
   *
   * @param {Object} p
   * @param {string} p.shopId
   * @param {string} p.from  - the customer's phone (E.164)
   * @param {string} [p.to]  - the shop's number
   * @param {string} p.body  - message text (e.g. 'STOP')
   * @returns {Promise<any>} whatever the inbound handler returns (or the payload)
   */
  async simulateInboundSms({ shopId, from, to = '+10000000000', body }) {
    const payload = {
      // Twilio inbound webhook fields (subset)
      MessageSid: `SIM-IN-${crypto.randomBytes(5).toString('hex')}`,
      AccountSid: 'ACsimulation',
      From: from,
      To: to,
      Body: body,
      NumMedia: '0',
      // engine convenience: which shop this belongs to
      shopId,
      __simulated: true,
    };
    this.inboundLog.push({ ...payload, receivedAt: new Date().toISOString() });

    if (this._onInbound) {
      return this._onInbound(payload);
    }
    return payload;
  }

  /** Clear all logs (handy between test cases). */
  reset() {
    this.sentLog.length = 0;
    this.inboundLog.length = 0;
    this._byId.clear();
    this._sendCount = 0;
  }
}

module.exports = { SimulationProvider };
