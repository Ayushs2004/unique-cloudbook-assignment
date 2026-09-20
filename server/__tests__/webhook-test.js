const request = require('supertest');
const express = require('express');
const { createWebhookRouter } = require('../routes/webhook');
const { createLeadsRouter } = require('../routes/leads');
const { InMemoryLeadStore } = require('../services/leadStore');
const { calculateSignature } = require('../services/signature');
const { rawBodySaver } = require('../middleware/rawBody');

describe('Webhook and Leads Routes', () => {
  const appSecret = 'test_secret_key_123';
  const verifyToken = 'test_verify_token_abc';

  let app;
  let store;
  let mockGraphApi;
  let mockEmitNewLead;

  beforeEach(() => {
    store = new InMemoryLeadStore();
    mockEmitNewLead = jest.fn();
    mockGraphApi = {
      fetchLead: jest.fn().mockImplementation(async (id, opts) => ({
        id,
        formId: opts.formId || 'form_default',
        pageId: opts.pageId || 'page_default',
        name: 'Test Lead',
        email: 'lead@example.com',
        phone: '+1234567890',
        rawFieldData: {},
        receivedAt: new Date().toISOString(),
      })),
    };

    app = express();
    app.use(express.json({ verify: rawBodySaver }));

    const webhookRouter = createWebhookRouter({
      store,
      graphApi: mockGraphApi,
      emitNewLead: mockEmitNewLead,
      appSecret,
      verifyToken,
    });

    const leadsRouter = createLeadsRouter(store);

    app.use('/webhook', webhookRouter);
    app.use('/leads', leadsRouter);
  });

  describe('GET /webhook (Meta challenge verification)', () => {
    it('returns challenge with 200 when hub.verify_token and mode match', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': '1158201444',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('1158201444');
    });

    it('returns 403 Forbidden when token does not match', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '1158201444',
        });

      expect(response.status).toBe(403);
    });

    it('returns 403 when mode is not subscribe', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'unknown_mode',
          'hub.verify_token': verifyToken,
          'hub.challenge': '1158201444',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook (Lead reception and processing)', () => {
    function createSignedPayload(payloadObj) {
      const payloadStr = JSON.stringify(payloadObj);
      const signature = calculateSignature(Buffer.from(payloadStr, 'utf-8'), appSecret);
      return { payloadStr, signature: `sha256=${signature}` };
    }

    it('rejects request with 401 if signature is missing', async () => {
      const payload = { entry: [] };
      const response = await request(app).post('/webhook').send(payload);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or missing signature');
    });

    it('rejects request with 401 if signature is invalid', async () => {
      const payload = { entry: [] };
      const response = await request(app)
        .post('/webhook')
        .set('x-hub-signature-256', 'sha256=invalid_hex_code')
        .send(payload);

      expect(response.status).toBe(401);
    });

    it('acknowledges with 200 immediately before slow Graph API resolves (ack-before-fetch timing)', async () => {
      let graphApiStarted = false;
      let graphApiFinished = false;

      mockGraphApi.fetchLead.mockImplementation(async (id, opts) => {
        graphApiStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 150));
        graphApiFinished = true;
        return {
          id,
          formId: 'f1',
          pageId: 'p1',
          name: 'Slow Lead',
          rawFieldData: {},
          receivedAt: new Date().toISOString(),
        };
      });

      const bodyObj = {
        entry: [
          {
            id: 'page_100',
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: 'lead_slow_1',
                  form_id: 'form_100',
                  created_time: 1234567,
                },
              },
            ],
          },
        ],
      };

      const { payloadStr, signature } = createSignedPayload(bodyObj);

      const startTime = Date.now();
      const response = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .send(payloadStr);
      const ackDuration = Date.now() - startTime;

      // Assert 200 returned quickly before slow Graph API finished
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(ackDuration).toBeLessThan(120);
      expect(graphApiFinished).toBe(false);

      // Now wait for async background work to complete
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(graphApiFinished).toBe(true);
      expect(await store.exists('lead_slow_1')).toBe(true);
      expect(mockEmitNewLead).toHaveBeenCalledTimes(1);
    });

    it('handles duplicate leadgen_id idempotently producing exactly one emit', async () => {
      const bodyObj = {
        entry: [
          {
            id: 'page_200',
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: 'lead_duplicate_test',
                  form_id: 'form_200',
                  created_time: 1234567,
                },
              },
            ],
          },
        ],
      };

      const { payloadStr, signature } = createSignedPayload(bodyObj);

      // First webhook post
      const firstRes = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .send(payloadStr);

      expect(firstRes.status).toBe(200);

      // Wait for background processing
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockEmitNewLead).toHaveBeenCalledTimes(1);
      expect(mockGraphApi.fetchLead).toHaveBeenCalledTimes(1);

      // Second webhook post with identical leadgen_id
      const secondRes = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', signature)
        .send(payloadStr);

      expect(secondRes.status).toBe(200);

      // Wait for background processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Emitted exactly once! Graph API called exactly once!
      expect(mockEmitNewLead).toHaveBeenCalledTimes(1);
      expect(mockGraphApi.fetchLead).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /leads (REST Hydrate Endpoint)', () => {
    it('returns empty array when no leads are present', async () => {
      const response = await request(app).get('/leads');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('returns stored leads newest first', async () => {
      await store.save({
        id: 'lead_1',
        formId: 'f1',
        pageId: 'p1',
        name: 'Lead 1',
        receivedAt: new Date('2024-01-01T10:00:00.000Z').toISOString(),
      });
      await store.save({
        id: 'lead_2',
        formId: 'f1',
        pageId: 'p1',
        name: 'Lead 2',
        receivedAt: new Date('2024-01-01T12:00:00.000Z').toISOString(),
      });

      const response = await request(app).get('/leads');
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body[0].id).toBe('lead_2');
      expect(response.body[1].id).toBe('lead_1');
    });

    it('supports ?since= timestamp filter', async () => {
      await store.save({
        id: 'lead_old',
        formId: 'f1',
        pageId: 'p1',
        name: 'Old Lead',
        receivedAt: new Date('2024-01-01T08:00:00.000Z').toISOString(),
      });
      await store.save({
        id: 'lead_new',
        formId: 'f1',
        pageId: 'p1',
        name: 'New Lead',
        receivedAt: new Date('2024-01-01T10:00:00.000Z').toISOString(),
      });

      const response = await request(app).get('/leads').query({ since: '2024-01-01T09:00:00.000Z' });
      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe('lead_new');
    });
  });
});
