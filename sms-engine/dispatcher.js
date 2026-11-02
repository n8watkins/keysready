'use strict';

/**
 * dispatcher.js
 * -------------
 * The outbound delivery pipeline.
 *
 * enqueue(job) -> in-memory queue -> async worker loop -> provider.send()
 *
 * The worker, per job:
 *   1. CONSENT GATE   — block if the recipient is not opted in (except auto-replies).
 *   2. QUIET HOURS    — if outside the allowed window, DEFER to nextSendableTime
 *                       (except STOP/HELP auto-replies, which are always exempt).
 *   3. RENDER         — turn (status, vars) into message text via templates.
 *   4. SEND           — call the channel's provider via the registry.
 *   5. RETRY          — on transient failure, re-enqueue with exponential backoff.
 *   6. LOG            — append the outcome to an in-memory Message log.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SWAPPABLE QUEUE ABSTRACTION
 * ─────────────────────────────────────────────────────────────────────────────
 * This uses a trivial in-memory array + setInterval worker so the demo runs on
 * pure Node. The surface is deliberately tiny so it maps 1:1 onto a real queue:
 *
 *   In-memory (here)        BullMQ / Redis              Cloudflare Queues
 *   ----------------        -------------------------   --------------------------
 *   enqueue(job)            queue.add('send', job,      env.QUEUE.send(job,
 *                             { delay, attempts,          { delaySeconds })
 *                               backoff })
 *   worker loop /           new Worker('send', fn,      export default {
 *     _processOne             { concurrency })            async queue(batch,env){...}}
 *   delayUntil (defer)      job opts { delay }          message delaySeconds /
 *                                                         Durable Object alarm
 *   retry/backoff           job opts { attempts,        explicit re-enqueue with
 *                             backoff:{type:'exp'} }      delaySeconds, or retry()
 *   Message log             a 'messages' table          D1 / KV / Durable Object
 *
 * To migrate: replace `_queue`/`_processOne`/`start` with the platform's worker,
 * keep `_handleJob` (steps 1–6) verbatim — it has no in-memory-queue assumptions.
 */

const templates = require('./templates');
const quietHours = require('./quietHours');

let _idSeq = 0;
function nextId(prefix) {
  _idSeq += 1;
  return `${prefix}-${Date.now()}-${_idSeq}`;
}

/**
 * @typedef {Object} NotificationJob
 * @property {string}  channel    - 'sms' | 'webpush'
 * @property {string}  to         - phone (sms) or subscription id (webpush)
 * @property {string}  shopId
 * @property {string} [shopName]
 * @property {string} [status]    - booking status -> selects a template
 * @property {object} [vars]      - template vars { firstName, ref, vehicle, etaDate }
 * @property {string} [body]      - explicit body (bypasses templates; used by auto-replies)
 * @property {string} [title]     - web push title
 * @property {string}  timezone   - recipient IANA tz (for quiet hours)
 * @property {boolean} [isAutoReply] - STOP/HELP/START reply: skip consent gate + quiet hours
 * @property {boolean} [bypassConsent] - internal/staff messages that don't need SMS consent
 * @property {object} [meta]      - bookingId etc.
 * @property {number} [notBefore] - epoch ms; worker won't process before this (defer)
 * @property {number} [attempts]  - internal retry counter
 */

class Dispatcher {
  /**
   * @param {Object} deps
   * @param {import('./provider').ProviderRegistry} deps.registry
   * @param {import('./consent').ConsentStore} deps.consent
   * @param {Object} [deps.quietHoursOptions] - { startHour, endHour }
   * @param {Object} [deps.retry] - { maxAttempts, baseDelayMs }
   * @param {(entry:object)=>void} [deps.onLog] - optional log sink (e.g. console)
   */
  constructor(deps) {
    if (!deps || !deps.registry || !deps.consent) {
      throw new Error('Dispatcher requires { registry, consent }');
    }
    this.registry = deps.registry;
    this.consent = deps.consent;
    this.quietHoursOptions = deps.quietHoursOptions || {};
    this.retry = Object.assign(
      { maxAttempts: 3, baseDelayMs: 200 },
      deps.retry || {}
    );
    this._onLog = deps.onLog || null;

    /** @type {NotificationJob[]} the in-memory queue */
    this._queue = [];
    /** @type {object[]} the Message log (every outcome) */
    this.messageLog = [];
    this._timer = null;
    this._running = false;
    this._tickMs = deps.tickMs || 25;
    /** Resolvers waiting for the queue to drain (for the demo/tests). */
    this._idleResolvers = [];
  }

  /**
   * Add a job to the queue. Returns the assigned job id.
   * @param {NotificationJob} job
   * @returns {string} jobId
   */
  enqueue(job) {
    const queued = Object.assign(
      { id: nextId('job'), attempts: 0, enqueuedAt: Date.now() },
      job
    );
    this._queue.push(queued);
    return queued.id;
  }

  /** Start the async worker loop (idempotent). */
  start() {
    if (this._running) return;
    this._running = true;
    const tick = async () => {
      if (!this._running) return;
      await this._drainReady();
      if (this._running) this._timer = setTimeout(tick, this._tickMs);
    };
    this._timer = setTimeout(tick, this._tickMs);
  }

  /** Stop the worker loop. */
  stop() {
    this._running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  /**
   * Resolve once the queue has no jobs that are ready to run (deferred jobs whose
   * notBefore is still in the future do NOT block idle). For demos/tests.
   * @returns {Promise<void>}
   */
  onIdle() {
    if (this._readyCount() === 0) return Promise.resolve();
    return new Promise((res) => this._idleResolvers.push(res));
  }

  _readyCount() {
    const now = Date.now();
    return this._queue.filter((j) => !j.notBefore || j.notBefore <= now).length;
  }

  _maybeSignalIdle() {
    if (this._readyCount() === 0 && this._idleResolvers.length) {
      const resolvers = this._idleResolvers.splice(0);
      resolvers.forEach((r) => r());
    }
  }

  /** Process every job whose notBefore has elapsed. */
  async _drainReady() {
    const now = Date.now();
    // Pull ready jobs out, preserving order.
    const ready = [];
    const remaining = [];
    for (const job of this._queue) {
      if (!job.notBefore || job.notBefore <= now) ready.push(job);
      else remaining.push(job);
    }
    this._queue = remaining;

    for (const job of ready) {
      // eslint-disable-next-line no-await-in-loop
      await this._handleJob(job);
    }
    this._maybeSignalIdle();
  }

  _log(entry) {
    const record = Object.assign({ at: new Date().toISOString() }, entry);
    this.messageLog.push(record);
    if (this._onLog) this._onLog(record);
    return record;
  }

  /**
   * Steps 1–6 for a single job. PLATFORM-AGNOSTIC: contains no in-memory-queue
   * assumptions, so it can be lifted verbatim into a BullMQ Worker or a
   * Cloudflare `queue()` handler.
   * @param {NotificationJob} job
   */
  async _handleJob(job) {
    // ── 1. CONSENT GATE ──────────────────────────────────────────────────
    // Auto-replies (STOP/HELP confirmations) and explicitly-bypassed messages
    // (e.g. staff web-push) skip the SMS consent requirement.
    const needsConsent =
      job.channel === 'sms' && !job.isAutoReply && !job.bypassConsent;
    if (needsConsent && !this.consent.isOptedIn(job.shopId, job.to)) {
      return this._log({
        event: 'blocked',
        reason: 'not_opted_in',
        jobId: job.id,
        channel: job.channel,
        to: job.to,
        status: job.status,
      });
    }

    // ── 2. QUIET HOURS ───────────────────────────────────────────────────
    // SMS only. Auto-replies are exempt (must always answer STOP/HELP).
    if (job.channel === 'sms' && !job.isAutoReply) {
      const now = new Date();
      const ok = quietHours.isWithinQuietHours(
        now, job.timezone, this.quietHoursOptions
      );
      if (!ok) {
        const next = quietHours.nextSendableTime(
          now, job.timezone, this.quietHoursOptions
        );
        job.notBefore = next.getTime();
        this._queue.push(job); // re-queue for later
        return this._log({
          event: 'deferred',
          reason: 'quiet_hours',
          jobId: job.id,
          channel: job.channel,
          to: job.to,
          status: job.status,
          deferredUntil: next.toISOString(),
          timezone: job.timezone,
        });
      }
    }

    // ── 3. RENDER ────────────────────────────────────────────────────────
    let body = job.body;
    if (!body && job.status) {
      try {
        body = templates.render(job.status, job.vars || {});
      } catch (err) {
        return this._log({
          event: 'failed',
          reason: 'render_error',
          jobId: job.id,
          error: err.message,
        });
      }
    }
    if (!body) {
      return this._log({
        event: 'failed',
        reason: 'empty_body',
        jobId: job.id,
      });
    }

    // ── 4. SEND ──────────────────────────────────────────────────────────
    let provider;
    try {
      provider = this.registry.forChannel(job.channel);
    } catch (err) {
      return this._log({
        event: 'failed',
        reason: 'no_provider',
        jobId: job.id,
        channel: job.channel,
        error: err.message,
      });
    }

    const message = {
      channel: job.channel,
      to: job.to,
      body,
      title: job.title,
      data: job.data,
      statusCallbackUrl: job.statusCallbackUrl,
      meta: Object.assign({ shopId: job.shopId, status: job.status }, job.meta),
    };

    try {
      const result = await provider.send(message);
      return this._log({
        event: 'sent',
        jobId: job.id,
        channel: job.channel,
        to: job.to,
        status: job.status,
        provider: result.provider,
        providerId: result.providerId,
        providerStatus: result.status,
        body,
        isAutoReply: !!job.isAutoReply,
      });
    } catch (err) {
      // ── 5. RETRY w/ EXPONENTIAL BACKOFF ───────────────────────────────
      job.attempts = (job.attempts || 0) + 1;
      const retryable = err.transient !== false; // default to retryable
      if (retryable && job.attempts < this.retry.maxAttempts) {
        const delay = this.retry.baseDelayMs * 2 ** (job.attempts - 1);
        job.notBefore = Date.now() + delay;
        this._queue.push(job);
        return this._log({
          event: 'retry',
          jobId: job.id,
          attempt: job.attempts,
          delayMs: delay,
          error: err.message,
        });
      }
      return this._log({
        event: 'failed',
        reason: 'provider_error',
        jobId: job.id,
        attempts: job.attempts,
        error: err.message,
      });
    }
  }
}

module.exports = { Dispatcher };
