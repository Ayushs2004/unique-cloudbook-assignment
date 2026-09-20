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

  return router;
}

module.exports = {
  createLeadsRouter,
  leadsRouter: createLeadsRouter(),
};
