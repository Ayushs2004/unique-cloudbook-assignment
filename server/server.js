const http = require('http');
const express = require('express');
const { validateEnv } = require('./config/env');
const { rawBodySaver } = require('./middleware/rawBody');
const { initSocket, getConnectedCount } = require('./realtime/io');
const { webhookRouter } = require('./routes/webhook');
const { leadsRouter } = require('./routes/leads');

/**
 * Creates and configures the Express application.
 * @returns {express.Application}
 */
function createApp() {
  const app = express();

  // Middleware: JSON parser with raw body buffer captured for HMAC signature verification
  app.use(express.json({ verify: rawBodySaver }));
  app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));

  // Basic CORS headers for dev / testing
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, x-hub-signature-256');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health endpoint (§7 Observability)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      connectedClients: getConnectedCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routes
  app.use('/webhook', webhookRouter);
  app.use('/leads', leadsRouter);

  return app;
}

const { leadStore } = require('./services/leadStore');

/**
 * Seeds initial realistic mock leads into the store on server startup.
 * @param {import('./services/leadStore').InMemoryLeadStore} [store=leadStore]
 */
async function seedInitialLeads(store = leadStore) {
  const mockLeads = [
    {
      id: 'lead_meta_101',
      formId: 'form_growth_ad_01',
      pageId: 'page_acme_official',
      name: 'Alexander Wright',
      email: 'alex.wright@example.com',
      phone: '+1 (555) 234-5678',
      rawFieldData: {
        full_name: 'Alexander Wright',
        email: 'alex.wright@example.com',
        phone_number: '+1 (555) 234-5678',
      },
      receivedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: 'lead_meta_102',
      formId: 'form_growth_ad_01',
      pageId: 'page_acme_official',
      name: 'Sophia Martinez',
      email: 'sophia.m@example.com',
      phone: '+1 (555) 876-5432',
      rawFieldData: {
        full_name: 'Sophia Martinez',
        email: 'sophia.m@example.com',
        phone_number: '+1 (555) 876-5432',
      },
      receivedAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
    },
    {
      id: 'lead_meta_103',
      formId: 'form_spring_launch',
      pageId: 'page_acme_official',
      name: 'David Chen',
      email: 'david.chen@enterprise.io',
      phone: '+1 (555) 432-1098',
      rawFieldData: {
        full_name: 'David Chen',
        email: 'david.chen@enterprise.io',
        phone_number: '+1 (555) 432-1098',
      },
      receivedAt: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
    },
  ];

  for (const lead of mockLeads) {
    await store.save(lead);
  }
}

/**
 * Starts the HTTP server and attaches Socket.IO.
 */
function startServer() {
  const config = validateEnv();
  const app = createApp();
  const server = http.createServer(app);

  // Attach Socket.IO to shared HTTP server
  initSocket(server);

  // Seed realistic sample leads on boot
  seedInitialLeads(leadStore);

  server.listen(config.PORT, () => {
    console.log(`[server] Meta Lead Ads Webhook server listening on port ${config.PORT}`);
    console.log(`[server] Webhook endpoint: http://localhost:${config.PORT}/webhook`);
    console.log(`[server] Leads endpoint: http://localhost:${config.PORT}/leads`);
    console.log(`[server] Health endpoint: http://localhost:${config.PORT}/health`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
};
