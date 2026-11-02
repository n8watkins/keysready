'use strict';

/**
 * provider.js
 * -----------
 * The single, channel-agnostic interface that every notification provider
 * implements, plus a small registry so the rest of the engine can ask for
 * "the provider for the 'sms' channel" without knowing or caring whether
 * that is Twilio, the in-memory Simulation, or something else entirely.
 *
 * Channels are intentionally simple strings: 'sms' | 'webpush'.
 *
 * This is the seam that makes SMS and Web Push interchangeable: the
 * Dispatcher only ever talks to a `NotificationProvider`, never to Twilio
 * or web-push directly.
 */

/** @typedef {'sms' | 'webpush'} Channel */

/**
 * @typedef {Object} OutboundMessage
 * @property {Channel}  channel      - 'sms' | 'webpush'
 * @property {string}   to           - phone number (sms) or subscription id (webpush)
 * @property {string}   body         - rendered message text
 * @property {string}  [title]       - optional title (web push)
 * @property {object}  [data]        - optional structured payload (web push)
 * @property {string}  [statusCallbackUrl] - where the provider should POST delivery status
 * @property {object}  [meta]        - free-form metadata (shopId, bookingId, status, ...)
 */

/**
 * @typedef {Object} SendResult
 * @property {boolean} ok            - did the provider accept the message
 * @property {string}  providerId    - provider's id for the message (e.g. Twilio SID)
 * @property {string}  status        - provider status ('queued' | 'sent' | 'failed' ...)
 * @property {string}  provider      - provider.name that handled it
 * @property {object} [raw]          - raw provider response (for debugging)
 * @property {string} [error]        - error message when ok === false
 */

/**
 * NotificationProvider — the interface contract.
 *
 * Implementations MUST provide:
 *   - name              : a short, stable identifier (string)
 *   - supportsChannel(c): boolean, true if this provider can deliver on channel c
 *   - send(message)     : async, returns a SendResult
 *
 * This class can be extended, but duck typing is also fine — the registry only
 * checks for the three members above.
 */
class NotificationProvider {
  /**
   * @param {string} name
   * @param {Channel[]} channels - channels this provider can deliver on
   */
  constructor(name, channels = []) {
    if (new.target === NotificationProvider) {
      // Allow direct construction only for trivial/no-op use; concrete
      // providers should subclass and override send().
    }
    this.name = name;
    this._channels = new Set(channels);
  }

  /**
   * @param {Channel} channel
   * @returns {boolean}
   */
  supportsChannel(channel) {
    return this._channels.has(channel);
  }

  /**
   * Deliver a message. Must be overridden.
   * @param {OutboundMessage} _message
   * @returns {Promise<SendResult>}
   */
  // eslint-disable-next-line no-unused-vars
  async send(_message) {
    throw new Error(
      `${this.name || 'NotificationProvider'}.send() not implemented`
    );
  }
}

/**
 * ProviderRegistry — maps a channel to the provider that should handle it.
 *
 * Typical wiring:
 *   registry.register('sms', simulationProvider)
 *   registry.register('webpush', webPushProvider)
 *
 * The Dispatcher then calls registry.forChannel(job.channel).
 */
class ProviderRegistry {
  constructor() {
    /** @type {Map<Channel, NotificationProvider>} */
    this._byChannel = new Map();
    /** @type {Map<string, NotificationProvider>} */
    this._byName = new Map();
  }

  /**
   * Register a provider for a channel. A provider may be registered for
   * multiple channels (call register once per channel).
   * @param {Channel} channel
   * @param {NotificationProvider} provider
   * @returns {ProviderRegistry} this (chainable)
   */
  register(channel, provider) {
    if (!provider || typeof provider.send !== 'function') {
      throw new Error(`register('${channel}'): provider must implement send()`);
    }
    if (typeof provider.supportsChannel === 'function' &&
        !provider.supportsChannel(channel)) {
      throw new Error(
        `Provider '${provider.name}' does not support channel '${channel}'`
      );
    }
    this._byChannel.set(channel, provider);
    if (provider.name) this._byName.set(provider.name, provider);
    return this;
  }

  /**
   * Select the provider responsible for a channel.
   * @param {Channel} channel
   * @returns {NotificationProvider}
   */
  forChannel(channel) {
    const p = this._byChannel.get(channel);
    if (!p) {
      throw new Error(`No provider registered for channel '${channel}'`);
    }
    return p;
  }

  /**
   * @param {Channel} channel
   * @returns {boolean}
   */
  hasChannel(channel) {
    return this._byChannel.has(channel);
  }

  /**
   * Look up a provider by its name (e.g. to reach a Simulation's inbound API).
   * @param {string} name
   * @returns {NotificationProvider | undefined}
   */
  byName(name) {
    return this._byName.get(name);
  }

  /** @returns {Channel[]} */
  channels() {
    return [...this._byChannel.keys()];
  }
}

module.exports = {
  NotificationProvider,
  ProviderRegistry,
};
