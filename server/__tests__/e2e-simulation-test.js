const http = require('http');
const express = require('express');
const { io: ClientIO } = require('socket.io-client');
const request = require('supertest');
const { createApp } = require('../server');
const { initSocket, setIO } = require('../realtime/io');
const { leadStore } = require('../services/leadStore');
const graphApi = require('../services/graphApi');
const { calculateSignature } = require('../services/signature');

describe('End-to-End Simulation: Meta Webhook -> Graph API -> LeadStore -> Socket.IO -> Client', () => {
  let server;
  let clientSocket;
  let port;
  const testSecret = 'e2e_app_secret_987';
  const testVerifyToken = 'e2e_verify_token_123';
  const testPageToken = 'e2e_page_token_456';

  beforeAll((done) => {
    process.env.APP_SECRET = testSecret;
    process.env.VERIFY_TOKEN = testVerifyToken;
    process.env.PAGE_ACCESS_TOKEN = testPageToken;

    const app = createApp();
    server = http.createServer(app);
    initSocket(server);

    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    server.close(() => {
      done();
    });
  });

  beforeEach(async () => {
    await leadStore.clear();
  });

  it('delivers lead from signed webhook to connected socket client in real-time and deduplicates duplicate deliveries', (done) => {
    // Mock Graph API call to return field data for the test lead
    jest.spyOn(graphApi, 'fetchLead').mockResolvedValue({
      id: 'leadgen_live_8888',
      formId: 'form_prod_1',
      pageId: 'page_prod_1',
      name: 'Taylor Swift',
      email: 'taylor@example.com',
      phone: '+18005551234',
      rawFieldData: {
        full_name: 'Taylor Swift',
        email: 'taylor@example.com',
      },
      receivedAt: new Date().toISOString(),
    });

    // 1. Connect mobile client via Socket.IO
    clientSocket = ClientIO(`http://localhost:${port}`);

    clientSocket.on('connect', async () => {
      // 2. Client performs initial hydrate
      const hydrateRes = await request(server).get('/leads');
      expect(hydrateRes.status).toBe(200);
      expect(hydrateRes.body).toEqual([]);

      let receivedEventCount = 0;

      // 3. Client listens for "new-lead" event
      clientSocket.on('new-lead', async (incomingLead) => {
        receivedEventCount++;
        expect(incomingLead.id).toBe('leadgen_live_8888');
        expect(incomingLead.name).toBe('Taylor Swift');
        expect(incomingLead.email).toBe('taylor@example.com');

        if (receivedEventCount === 1) {
          // 4. Meta sends duplicate webhook payload (retry simulation)
          const dupRes = await request(server)
            .post('/webhook')
            .set('Content-Type', 'application/json')
            .set('x-hub-signature-256', `sha256=${signature}`)
            .send(payloadStr);

          expect(dupRes.status).toBe(200);

          // Wait to ensure no second emit arrives
          setTimeout(async () => {
            expect(receivedEventCount).toBe(1);
            const allLeads = await leadStore.listSince();
            expect(allLeads.length).toBe(1);
            done();
          }, 150);
        }
      });

      // 5. Meta Webhook POST with valid HMAC signature
      const webhookPayload = {
        entry: [
          {
            id: 'page_prod_1',
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: 'leadgen_live_8888',
                  form_id: 'form_prod_1',
                  page_id: 'page_prod_1',
                  created_time: 1710928000,
                },
              },
            ],
          },
        ],
      };

      const payloadStr = JSON.stringify(webhookPayload);
      const signature = calculateSignature(Buffer.from(payloadStr, 'utf-8'), testSecret);

      const postRes = await request(server)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', `sha256=${signature}`)
        .send(payloadStr);

      // Verify immediate 200 ack
      expect(postRes.status).toBe(200);
    });
  });
});
