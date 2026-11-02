'use strict';

/**
 * providers/webPush.js
 * --------------------
 * Real Web Push provider (used for STAFF notifications in this design).
 *
 * IMPORTANT: `web-push` is required LAZILY inside the constructor, so this file
 * loads fine without the package installed. The pure-Node demo uses the
 * SimulationProvider for the 'webpush' channel instead and never reaches here.
 *
 * Config comes from the environment:
 *   VAPID_PUBLIC_KEY   (required)
 *   VAPID_PRIVATE_KEY  (required)
 *   VAPID_SUBJECT      (required, e.g. 'mailto:ops@shop.example')
 *
 * A "subscription" is the PushSubscription object a browser produces
 * (endpoint + keys.p256dh + keys.auth). We keep a small in-memory store keyed
 * by an id so the dispatcher can send by id; in production this would be a DB.
 */

const { NotificationProvider } = require('../provider');

class WebPushProvider extends NotificationProvider {
  /**
   * @param {Object} [env] - defaults to process.env
   */
  constructor(env = process.env) {
    super('web-push', ['webpush']);

    this.publicKey = env.VAPID_PUBLIC_KEY;
    this.privateKey = env.VAPID_PRIVATE_KEY;
    this.subject = env.VAPID_SUBJECT;

    if (!this.publicKey || !this.privateKey || !this.subject) {
      throw new Error(
        'WebPushProvider requires VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT'
      );
    }

    // Lazy require: only when a real WebPushProvider is constructed.
    // eslint-disable-next-line global-require
    this._webpush = require('web-push');
    this._webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);

    /** @type {Map<string, object>} subscriptionId -> PushSubscription */
    this._subscriptions = new Map();
  }

  /**
   * Store a browser PushSubscription and return an id the dispatcher can target.
   * @param {string} id - stable id (e.g. staff user id or generated)
   * @param {object} subscription - the browser PushSubscription
   * @returns {string} id
   */
  saveSubscription(id, subscription) {
    this._subscriptions.set(id, subscription);
    return id;
  }

  /** @param {string} id */
  getSubscription(id) {
    return this._subscriptions.get(id);
  }

  /**
   * @param {import('../provider').OutboundMessage} message
   *   message.to is the subscription id (or you may pass message.data.subscription
   *   to send to an ad-hoc subscription not in the store).
   * @returns {Promise<import('../provider').SendResult>}
   */
  async send(message) {
    if (message.channel !== 'webpush') {
      throw new Error(`WebPushProvider cannot send channel '${message.channel}'`);
    }

    const subscription =
      (message.data && message.data.subscription) ||
      this._subscriptions.get(message.to);

    if (!subscription) {
      throw new Error(`No web-push subscription found for '${message.to}'`);
    }

    const payload = JSON.stringify({
      title: message.title || 'Notification',
      body: message.body,
      data: message.data || {},
    });

    try {
      const res = await this._webpush.sendNotification(subscription, payload);
      return {
        ok: true,
        providerId: `${message.to}:${Date.now()}`,
        status: 'sent',
        provider: this.name,
        raw: { statusCode: res && res.statusCode },
      };
    } catch (err) {
      // 404/410 mean the subscription is gone — prune it and DON'T retry.
      const gone = err.statusCode === 404 || err.statusCode === 410;
      if (gone) this._subscriptions.delete(message.to);
      const e = new Error(`Web push failed: ${err.message}`);
      e.transient = !gone && (!err.statusCode || err.statusCode >= 500);
      e.cause = err;
      throw e;
    }
  }
}

module.exports = { WebPushProvider };
