const express = require('express');
const { verifySignature } = require('../services/signature');
const { leadStore: defaultLeadStore } = require('../services/leadStore');
const defaultGraphApi = require('../services/graphApi');
const { emitNewLead: defaultEmitNewLead } = require('../realtime/io');
const { validateEnv } = require('../config/env');

/**
 * Creates the Webhook router with dependencies injected.
 *
 * @param {Object} [deps]
 * @param {import('../services/leadStore').InMemoryLeadStore} [deps.store]
 * @param {Object} [deps.graphApi]
 * @param {Function} [deps.emitNewLead]
 * @param {string} [deps.appSecret]
 * @param {string} [deps.verifyToken]
 */
function createWebhookRouter(deps = {}) {
  const router = express.Router();

  const store = deps.store || defaultLeadStore;
  const graphApi = deps.graphApi || defaultGraphApi;
  const emitNewLead = deps.emitNewLead || defaultEmitNewLead;

  function getConfig() {
    let appSecret = deps.appSecret;
    let verifyToken = deps.verifyToken;

    if (!appSecret || !verifyToken) {
      try {
        const env = validateEnv();
        appSecret = appSecret || env.APP_SECRET;
        verifyToken = verifyToken || env.VERIFY_TOKEN;
      } catch {
        appSecret = appSecret || process.env.APP_SECRET;
        verifyToken = verifyToken || process.env.VERIFY_TOKEN;
      }
    }

    return { appSecret, verifyToken };
  }

  // GET /webhook - Meta webhook challenge verification
  router.get('/', (req, res) => {
    const { verifyToken } = getConfig();

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
      console.log(JSON.stringify({ event: 'webhook_verified', timestamp: new Date().toISOString() }));
      return res.status(200).send(challenge);
    }

    console.warn(JSON.stringify({ event: 'webhook_verification_failed', mode, token }));
    return res.status(403).send('Forbidden');
  });

  // POST /webhook - Meta webhook notification
  router.post('/', (req, res) => {
    const { appSecret } = getConfig();
    const signatureHeader = req.headers['x-hub-signature-256'];

    // Verify raw body HMAC signature
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const isValid = verifySignature(rawBody, appSecret, signatureHeader);

    if (!isValid) {
      console.warn(JSON.stringify({ event: 'signature_verification_failed', signatureHeader }));
      return res.status(401).json({ error: 'Invalid or missing signature' });
    }

    // ACK IMMEDIATELY (ack-then-process) before any Graph API or async work
    res.status(200).json({ status: 'ok' });

    // Process asynchronously in background
    setImmediate(async () => {
      const payload = req.body;
      if (!payload || !Array.isArray(payload.entry)) {
        return;
      }

      for (const entry of payload.entry) {
        const pageId = entry.id;
        const changes = entry.changes;

        if (!Array.isArray(changes)) continue;

        for (const change of changes) {
          if (change.field === 'leadgen' && change.value) {
            const val = change.value;
            const leadgenId = String(val.leadgen_id || '');
            const formId = String(val.form_id || '');
            const entryPageId = String(val.page_id || pageId || '');

            if (!leadgenId) continue;

            const startTime = Date.now();
            console.log(
              JSON.stringify({
                leadgenId,
                event: 'received',
                timestamp: new Date().toISOString(),
              })
            );

            try {
              // Idempotency check: if already processed, skip silently
              const exists = await store.exists(leadgenId);
              if (exists) {
                console.log(
                  JSON.stringify({
                    leadgenId,
                    event: 'duplicate_skipped',
                    durationMs: Date.now() - startTime,
                  })
                );
                continue;
              }

              // Fetch full lead data from Meta Graph API
              let lead;
              try {
                lead = await graphApi.fetchLead(leadgenId, {
                  pageId: entryPageId,
                  formId,
                });
                console.log(
                  JSON.stringify({
                    leadgenId,
                    event: 'fetched',
                    durationMs: Date.now() - startTime,
                  })
                );
              } catch (fetchErr) {
                console.error(
                  JSON.stringify({
                    leadgenId,
                    event: 'fetch_failed',
                    error: fetchErr.message,
                    durationMs: Date.now() - startTime,
                  })
                );

                // As per reliability design §6: save placeholder lead so it's not silently lost
                lead = {
                  id: leadgenId,
                  formId,
                  pageId: entryPageId,
                  name: 'Pending Graph API retrieval',
                  rawFieldData: { error: fetchErr.message },
                  receivedAt: new Date().toISOString(),
                };
              }

              // Persist lead
              const newlySaved = await store.save(lead);
              if (newlySaved) {
                // Emit new-lead via Socket.IO
                emitNewLead(lead);
                console.log(
                  JSON.stringify({
                    leadgenId,
                    event: 'emitted',
                    durationMs: Date.now() - startTime,
                  })
                );
              }
            } catch (err) {
              console.error(
                JSON.stringify({
                  leadgenId,
                  event: 'processing_error',
                  error: err.message,
                  durationMs: Date.now() - startTime,
                })
              );
            }
          }
        }
      }
    });
  });

  return router;
}

module.exports = {
  createWebhookRouter,
  webhookRouter: createWebhookRouter(),
};
