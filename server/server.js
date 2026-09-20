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

/**
 * Starts the HTTP server and attaches Socket.IO.
 */
function startServer() {
  const config = validateEnv();
  const app = createApp();
  const server = http.createServer(app);

  // Attach Socket.IO to shared HTTP server
  initSocket(server);

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
