'use strict';

/**
 * engine.js
 * ---------
 * The composition root. Wires registry + consent + dispatcher + templates +
 * (optionally) the webhook router into one object, and exposes the high-level
 * API the rest of the app calls:
 *
 *   engine.notifyBookingStatusChange({ shopId, customer, booking, status, channel })
 *   engine.router()  // lazily builds the Express webhook router
 *
 * createNotificationEngine(opts) auto-selects providers:
 *   - If Twilio creds are present, register the real Twilio provider for 'sms';
 *     otherwise fall back to the SimulationProvider.
 *   - If VAPID creds are present, register the real Web Push provider for
 *     'webpush'; otherwise fall back to the SimulationProvider.
 *
 * The pure-Node demo passes no creds, so BOTH channels use the SimulationProvider
 * and nothing external is required.
 */

const { ProviderRegistry } = require('./provider');
const { SimulationProvider } = require('./providers/simulation');
const { ConsentStore } = require('./consent');
const { Dispatcher } = require('./dispatcher');

const DEFAULT_TZ = 'America/Chicago';

/**
 * Decide whether real provider creds are present in the environment.
 */
function hasTwilioCreds(env) {
  return !!(
    env.TWILIO_ACCOUNT_SID &&
    env.TWILIO_AUTH_TOKEN &&
    (env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_FROM_NUMBER)
  );
}
function hasVapidCreds(env) {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

/**
 * @typedef {Object} EngineOptions
 * @property {Object}  [env]            - environment (default process.env)
 * @property {boolean} [forceSimulation] - always use the SimulationProvider
 * @property {Object}  [quietHours]     - { startHour, endHour }
 * @property {Object}  [retry]          - { maxAttempts, baseDelayMs }
 * @property {string}  [defaultTimezone]
 * @property {string}  [shopName]
 * @property {(entry:object)=>void} [onLog] - log sink
 * @property {Object}  [providers]      - explicit { sms, webpush } overrides
 * @property {boolean} [autostart]      - start the dispatcher worker (default true)
 * @property {string}  [statusCallbackUrl] - per-message Twilio delivery callback URL
 * @property {string}  [publicBaseUrl]  - public base URL (for webhook signature verify)
 */

class NotificationEngine {
  /** @param {EngineOptions} [opts] */
  constructor(opts = {}) {
    const env = opts.env || process.env;
    this.env = env;
    this.defaultTimezone = opts.defaultTimezone || DEFAULT_TZ;
    this.shopName = opts.shopName || 'the shop';
    this.quietHoursOptions = opts.quietHours || {};

    // Optional per-message Twilio delivery status callback URL. Falls back to
    // the env var the Twilio provider also reads. Used by notifyBookingStatusChange.
    this.statusCallbackUrl =
      opts.statusCallbackUrl || env.TWILIO_STATUS_CALLBACK_URL || undefined;

    // Public base URL Twilio uses to reach our webhooks; needed to reconstruct
    // the exact signed URL during signature verification. Production should set
    // this (see webhooks.js fullUrl()).
    this.publicBaseUrl = opts.publicBaseUrl || env.PUBLIC_BASE_URL || '';

    this.registry = new ProviderRegistry();
    this.consent = new ConsentStore();

    // A single SimulationProvider can back BOTH channels when no creds exist.
    this.simulation = new SimulationProvider();

    const force = !!opts.forceSimulation;
    const overrides = opts.providers || {};

    // ── SMS channel selection ────────────────────────────────────────────
    if (overrides.sms) {
      this.registry.register('sms', overrides.sms);
      this.smsMode = overrides.sms.name;
    } else if (!force && hasTwilioCreds(env)) {
      // Lazy require keeps this file loadable without the twilio package.
      // eslint-disable-next-line global-require
      const { TwilioSmsProvider } = require('./providers/twilioSms');
      this.registry.register('sms', new TwilioSmsProvider(env));
      this.smsMode = 'twilio-sms';
    } else {
      this.registry.register('sms', this.simulation);
      this.smsMode = 'simulation';
    }

    // ── Web Push channel selection ───────────────────────────────────────
    if (overrides.webpush) {
      this.registry.register('webpush', overrides.webpush);
      this.pushMode = overrides.webpush.name;
    } else if (!force && hasVapidCreds(env)) {
      // eslint-disable-next-line global-require
      const { WebPushProvider } = require('./providers/webPush');
      this.registry.register('webpush', new WebPushProvider(env));
      this.pushMode = 'web-push';
    } else {
      this.registry.register('webpush', this.simulation);
      this.pushMode = 'simulation';
    }

    // ── Dispatcher ───────────────────────────────────────────────────────
    this.dispatcher = new Dispatcher({
      registry: this.registry,
      consent: this.consent,
      quietHoursOptions: this.quietHoursOptions,
      retry: opts.retry,
      onLog: opts.onLog,
    });

    // Wire the SimulationProvider's inbound hook to the same path the webhook
    // uses, so simulateInboundSms() exercises real consent/keyword logic.
    if (this.simulation && typeof this.simulation.setInboundHandler === 'function') {
      this.simulation.setInboundHandler((payload) =>
        this.handleInbound(payload)
      );
    }

    if (opts.autostart !== false) this.dispatcher.start();
  }

  /** Convenience: is a customer opted in for SMS at this shop? */
  isOptedIn(shopId, phone) {
    return this.consent.isOptedIn(shopId, phone);
  }

  /** Record an opt-in (e.g. from the booking form checkbox). */
  optIn(shopId, phone, rec) {
    return this.consent.optIn(shopId, phone, rec);
  }

  /**
   * High-level entry point: a booking changed status — notify the customer.
   *
   * @param {Object} p
   * @param {string} p.shopId
   * @param {Object} p.customer - { firstName, phone, timezone? }
   * @param {Object} p.booking  - { ref, vehicle, etaDate?, id? }
   * @param {string} p.status   - PENDING|CONFIRMED|IN_PROGRESS|READY|COMPLETED|CANCELLED
   * @param {string} [p.channel='sms']
   * @returns {string} the enqueued job id
   */
  notifyBookingStatusChange({ shopId, customer, booking, status, channel = 'sms' }) {
    const vars = {
      firstName: customer.firstName,
      ref: booking.ref,
      vehicle: booking.vehicle,
      etaDate: booking.etaDate,
    };
    return this.dispatcher.enqueue({
      channel,
      to: channel === 'sms' ? customer.phone : customer.subscriptionId,
      shopId,
      shopName: this.shopName,
      status,
      vars,
      timezone: customer.timezone || this.defaultTimezone,
      statusCallbackUrl: this.statusCallbackUrl,
      meta: { bookingId: booking.id, ref: booking.ref },
    });
  }

  /**
   * Process an inbound message payload (Twilio-shaped). Shared by the webhook
   * router and the simulation's inbound hook. Runs keyword/consent first and
   * enqueues any required auto-reply.
   * @param {Object} payload - { From, To, Body, shopId?, timezone? }
   */
  handleInbound(payload) {
    const from = payload.From;
    const text = payload.Body || '';
    const shopId = payload.shopId || 'shop_default';
    const result = this.consent.handleKeyword(shopId, from, text, {
      shopName: this.shopName,
    });

    if (result.intent !== 'none' && result.autoReply) {
      this.dispatcher.enqueue({
        channel: 'sms',
        to: from,
        shopId,
        shopName: this.shopName,
        body: result.autoReply,
        isAutoReply: true,
        timezone: payload.timezone || this.defaultTimezone,
        meta: { kind: 'auto_reply', intent: result.intent },
      });
    }
    return result;
  }

  /**
   * Build (once) and return the Express webhook router. Requires express; the
   * pure-Node demo never calls this.
   * @param {Object} [routerOpts]
   * @returns {import('express').Router}
   */
  router(routerOpts = {}) {
    if (this._router) return this._router;
    // eslint-disable-next-line global-require
    const { createWebhookRouter } = require('./webhooks');
    const isSimulation = this.smsMode === 'simulation';
    this._router = createWebhookRouter(
      Object.assign(
        {
          consent: this.consent,
          dispatcher: this.dispatcher,
          registry: this.registry,
          shopName: this.shopName,
          authToken: this.env.TWILIO_AUTH_TOKEN,
          publicBaseUrl: this.publicBaseUrl,
          simulationMode: isSimulation,
          // SECURITY: only allow the 'x-sim-bypass' header to skip Twilio
          // signature verification when we're in simulation mode (no real
          // provider). When a real Twilio provider is active this is false, so
          // the bypass header is never honored and signatures are always
          // enforced.
          allowBypassHeader: isSimulation,
        },
        routerOpts
      )
    );
    return this._router;
  }

  /** Stop the worker (call on shutdown / after demo). */
  stop() {
    this.dispatcher.stop();
  }
}

/**
 * Factory. Defaults to the SimulationProvider when no creds are present.
 * @param {EngineOptions} [opts]
 * @returns {NotificationEngine}
 */
function createNotificationEngine(opts = {}) {
  return new NotificationEngine(opts);
}

module.exports = {
  NotificationEngine,
  createNotificationEngine,
  hasTwilioCreds,
  hasVapidCreds,
};
