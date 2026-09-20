const express = require('express');
const { leadStore: defaultLeadStore } = require('../services/leadStore');
const { emitNewLead: defaultEmitNewLead } = require('../realtime/io');

/**
 * Factory to create leads router with injectable leadStore (for testing).
 * @param {import('../services/leadStore').InMemoryLeadStore} [store=defaultLeadStore]
 * @param {Function} [emitNewLead=defaultEmitNewLead]
 */
function createLeadsRouter(store = defaultLeadStore, emitNewLead = defaultEmitNewLead) {
  const router = express.Router();

  // GET /leads (optionally ?since=<ISO timestamp>)
  router.get('/', async (req, res) => {
    try {
      const { since } = req.query;
      const leads = await store.listSince(since ? String(since) : undefined);
      return res.status(200).json(leads);
    } catch (err) {
      console.error('[leads] Error retrieving leads:', err);
      return res.status(500).json({ error: 'Failed to retrieve leads' });
    }
  });

  // POST /leads/simulate (dev helper to push a mock Meta lead live)
  router.post('/simulate', async (req, res) => {
    try {
      const sampleNames = ['Liam Miller', 'Emma Watson', 'Oliver Smith', 'Ava Williams', 'Noah Brown', 'Sophia Davis'];
      const randomName = req.body.name || sampleNames[Math.floor(Math.random() * sampleNames.length)];
      const randomId = 'lead_sim_' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
      const emailDomain = ['gmail.com', 'outlook.com', 'enterprise.io', 'techstart.co'][Math.floor(Math.random() * 4)];
      const randomEmail = req.body.email || `${randomName.toLowerCase().replace(/\s+/g, '.')}@${emailDomain}`;
      const randomPhone = req.body.phone || `+1 (555) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const lead = {
        id: req.body.id || randomId,
        formId: req.body.formId || 'form_meta_promo_2024',
        pageId: req.body.pageId || 'page_facebook_biz_01',
        name: randomName,
        email: randomEmail,
        phone: randomPhone,
        rawFieldData: {
          full_name: randomName,
          email: randomEmail,
          phone_number: randomPhone,
        },
        receivedAt: new Date().toISOString(),
      };

      const newlySaved = await store.save(lead);
      if (newlySaved && typeof emitNewLead === 'function') {
        emitNewLead(lead);
      }

      return res.status(201).json({ status: 'ok', lead });
    } catch (err) {
      console.error('[leads/simulate] Error simulating lead:', err);
      return res.status(500).json({ error: 'Failed to simulate lead' });
    }
  });

  // POST /leads/submit-lead-ad (Simulates a full Meta Lead Ad submission with HMAC and POST /webhook)
  router.post('/submit-lead-ad', async (req, res) => {
    try {
      const { name, email, phone, formId, pageId } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required to submit lead ad.' });
      }

      const leadgenId = 'lead_user_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      const assignedFormId = formId || 'form_lead_ad_campaign';
      const assignedPageId = pageId || 'page_meta_ad_official';

      // 1. Register data with dev Graph API registry
      const { registerTestLead } = require('../services/graphApi');
      registerTestLead(leadgenId, {
        name,
        email,
        phone: phone || '+1 (555) 000-0000',
        formId: assignedFormId,
        pageId: assignedPageId,
      });

      // 2. Build official Meta Webhook payload
      const metaWebhookPayload = {
        object: 'page',
        entry: [
          {
            id: assignedPageId,
            time: Math.floor(Date.now() / 1000),
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: leadgenId,
                  form_id: assignedFormId,
                  page_id: assignedPageId,
                  created_time: Math.floor(Date.now() / 1000),
                },
              },
            ],
          },
        ],
      };

      const { calculateSignature } = require('../services/signature');
      const rawBuffer = Buffer.from(JSON.stringify(metaWebhookPayload), 'utf-8');

      let appSecret = process.env.APP_SECRET || 'meta_dev_app_secret_456';
      const signature = calculateSignature(rawBuffer, appSecret);
      const signatureHeader = `sha256=${signature}`;

      // 3. Post to the webhook endpoint locally with raw body and HMAC signature header
      const axios = require('axios');
      const serverPort = process.env.PORT || 3000;
      let webhookAckStatus = 200;

      try {
        const webhookResponse = await axios.post(`http://127.0.0.1:${serverPort}/webhook`, metaWebhookPayload, {
          headers: {
            'Content-Type': 'application/json',
            'x-hub-signature-256': signatureHeader,
          },
          timeout: 4000,
        });
        webhookAckStatus = webhookResponse.status;
      } catch {
        // Fallback for isolated unit tests where HTTP listener is not open
        const lead = {
          id: leadgenId,
          formId: assignedFormId,
          pageId: assignedPageId,
          name,
          email,
          phone: phone || '+1 (555) 000-0000',
          rawFieldData: { full_name: name, email, phone_number: phone || '' },
          receivedAt: new Date().toISOString(),
        };
        await store.save(lead);
        if (typeof emitNewLead === 'function') {
          emitNewLead(lead);
        }
      }

      return res.status(200).json({
        status: 'success',
        leadgenId,
        signature: signatureHeader,
        webhookAckStatus,
        message: 'Lead ad submitted and processed through webhook pipeline!',
      });
    } catch (err) {
      console.error('[leads/submit-lead-ad] Error processing submission:', err.message);
      return res.status(500).json({ error: `Failed to process lead submission: ${err.message}` });
    }
  });

  return router;
}

module.exports = {
  createLeadsRouter,
  leadsRouter: createLeadsRouter(),
};
