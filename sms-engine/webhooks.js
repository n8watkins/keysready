'use strict';

/**
 * webhooks.js
 * -----------
 * Express Router for the INBOUND side of the two-way engine.
 *
 * Routes:
 *   POST /webhooks/twilio/inbound  - a customer texted us (keyword + threading)
 *   POST /webhooks/twilio/status   - delivery status callback for an outbound msg
 *   POST /push/subscribe           - browser registers a Web Push subscription
 *   POST /push/test                - send a test push to a stored subscription
 *
 * Signature verification: Twilio routes are protected with
 * verifyTwilioSignature(). In simulation mode you can bypass it by constructing
 * the router with { simulationMode:true } OR by sending header
 * 'x-sim-bypass: 1'. The header is ONLY honored when BOTH allowBypassHeader is
 * true AND the engine is in simulation mode — with a real Twilio provider
 * active it is never honored, so the bypass can't be used to forge requests.
 *
 * `express` is required at the top because it is already a dependency of the
 * server. The pure-Node DEMO does not import this file, so it never needs
 * express. (engine.js also lazy-loads this router only when asked.)
 */

const express = require('express');
const { verifyTwilioSignature } = require('./providers/twilioSms');

/**
 * Build the webhook router.
 *
 * @param {Object} deps
 * @param {import('./consent').ConsentStore} deps.consent
 * @param {import('./dispatcher').Dispatcher} deps.dispatcher
 * @param {import('./provider').ProviderRegistry} deps.registry
 * @param {Object} [deps.threads] - optional thread store (attach inbound msgs)
 * @param {string} [deps.shopId] - default shopId for inbound (single-tenant demo)
 * @param {string} [deps.shopName]
 * @param {string} [deps.authToken] - Twilio auth token for signature checks
 * @param {string} [deps.publicBaseUrl] - public URL Twilio used (for signature)
 * @param {boolean} [deps.simulationMode] - bypass signature verification
 * @param {boolean} [deps.allowBypassHeader] - honor 'x-sim-bypass' header
 * @returns {import('express').Router}
 */
function createWebhookRouter(deps) {
  const {
    consent,
    dispatcher,
    registry,
    threads,
    shopId: defaultShopId = 'shop_default',
    shopName = 'the shop',
    authToken,
    publicBaseUrl = '',
    simulationMode = false,
    allowBypassHeader = false,
  } = deps;

  const router = express.Router();

  // Twilio posts application/x-www-form-urlencoded.
  router.use(express.urlencoded({ extended: false }));
  router.use(express.json());

  /**
   * Reconstruct the absolute URL Twilio signed (scheme+host+path).
   *
   * Twilio computes its signature over the EXACT URL it requested, so this must
   * match byte-for-byte. In production set `publicBaseUrl` (e.g.
   * 'https://app.example.com') and make sure the app trusts the proxy — then we
   * use that explicit value and never depend on attacker-controllable request
   * headers. We only fall back to x-forwarded-proto/host (or req.protocol/host)
   * in non-production, where the headers are convenient and not security
   * critical; in production an unset publicBaseUrl will yield a URL that won't
   * match Twilio's signature, surfacing the misconfiguration loudly.
   */
  function fullUrl(req) {
    if (publicBaseUrl) return publicBaseUrl + req.originalUrl;
    if (process.env.NODE_ENV !== 'production') {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      return `${proto}://${req.get('host')}${req.originalUrl}`;
    }
    // Production with no publicBaseUrl: do not trust request headers. Build a
    // best-effort URL from req.protocol/host (which respect Express 'trust
    // proxy') so a correctly-configured proxy still verifies, and a
    // misconfigured one fails closed (signature mismatch -> 403).
    return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  }

  /** Verify a Twilio request, honoring sim bypass. Returns true if allowed. */
  function twilioVerified(req) {
    if (simulationMode) return true;
    // The dev/sim bypass header is ONLY honored when explicitly enabled AND the
    // engine is in simulation mode. With a real Twilio provider active,
    // simulationMode is false and we always require a valid signature, so the
    // header can never be used to skip verification on a live endpoint.
    if (allowBypassHeader && req.headers['x-sim-bypass'] === '1') return true;
    const signature = req.headers['x-twilio-signature'];
    return verifyTwilioSignature(authToken, signature, fullUrl(req), req.body);
  }

  // ── POST /webhooks/twilio/inbound ────────────────────────────────────────
  // A customer replied. Run keyword/consent FIRST; auto-ack STOP/HELP/START.
  // Otherwise, attach the message to a conversation thread.
  router.post('/webhooks/twilio/inbound', (req, res) => {
    if (!twilioVerified(req)) {
      return res.status(403).type('text/plain').send('invalid signature');
    }

    const from = req.body.From;
    const to = req.body.To;
    const text = req.body.Body || '';
    const shopId = req.body.shopId || defaultShopId;

    // 1) Keyword handling (opt-out / help / opt-in) takes priority.
    const result = consent.handleKeyword(shopId, from, text, { shopName });

    if (result.intent !== 'none' && result.autoReply) {
      // Auto-reply is exempt from consent gate + quiet hours.
      dispatcher.enqueue({
        channel: 'sms',
        to: from,
        shopId,
        shopName,
        body: result.autoReply,
        isAutoReply: true,
        timezone: req.body.timezone || 'America/Chicago',
        meta: { kind: 'auto_reply', intent: result.intent },
      });
      // Respond with empty TwiML (we send via the API, not via TwiML here).
      return res
        .status(200)
        .type('text/xml')
        .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // 2) Not a keyword — attach to a thread for staff follow-up.
    if (threads && typeof threads.attachInbound === 'function') {
      threads.attachInbound({ shopId, from, to, text, raw: req.body });
    }
    return res
      .status(200)
      .type('text/xml')
      .send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  // ── POST /webhooks/twilio/status ─────────────────────────────────────────
  // Delivery status callback. Update the matching Message log entry.
  router.post('/webhooks/twilio/status', (req, res) => {
    if (!twilioVerified(req)) {
      return res.status(403).type('text/plain').send('invalid signature');
    }
    const sid = req.body.MessageSid || req.body.SmsSid;
    const status = req.body.MessageStatus || req.body.SmsStatus;

    // Find the most recent 'sent' log entry for this provider id and update it.
    const entry = [...dispatcher.messageLog]
      .reverse()
      .find((e) => e.providerId === sid);
    if (entry) {
      entry.providerStatus = status;
      entry.statusUpdatedAt = new Date().toISOString();
    }
    return res.status(204).end();
  });

  // ── POST /push/subscribe ─────────────────────────────────────────────────
  // Store a browser PushSubscription (for STAFF notifications).
  router.post('/push/subscribe', (req, res) => {
    const provider = registry.hasChannel('webpush')
      ? registry.forChannel('webpush')
      : null;
    if (!provider || typeof provider.saveSubscription !== 'function') {
      return res
        .status(501)
        .json({ ok: false, error: 'web push not configured' });
    }
    const { id, subscription } = req.body || {};
    if (!id || !subscription) {
      return res
        .status(400)
        .json({ ok: false, error: 'id and subscription required' });
    }
    provider.saveSubscription(id, subscription);
    return res.status(201).json({ ok: true, id });
  });

  // ── POST /push/test ──────────────────────────────────────────────────────
  // Enqueue a test push to a stored subscription id.
  router.post('/push/test', (req, res) => {
    const { id, title, body } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: 'id required' });
    if (!registry.hasChannel('webpush')) {
      return res.status(501).json({ ok: false, error: 'web push not configured' });
    }
    const jobId = dispatcher.enqueue({
      channel: 'webpush',
      to: id,
      shopId: defaultShopId,
      title: title || 'Test notification',
      body: body || 'Web Push is working.',
      bypassConsent: true, // staff push, not SMS — no opt-in required
      timezone: 'America/Chicago',
      meta: { kind: 'push_test' },
    });
    return res.status(202).json({ ok: true, jobId });
  });

  return router;
}

module.exports = { createWebhookRouter };
