const express = require('express');
const { leadStore: defaultLeadStore } = require('../services/leadStore');

/**
 * Factory to create leads router with injectable leadStore (for testing).
 * @param {import('../services/leadStore').InMemoryLeadStore} [store=defaultLeadStore]
 */
function createLeadsRouter(store = defaultLeadStore) {
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

  return router;
}

module.exports = {
  createLeadsRouter,
  leadsRouter: createLeadsRouter(),
};
