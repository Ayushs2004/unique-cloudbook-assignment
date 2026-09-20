# Meta Lead Ads → React Native Real-Time System

A production-grade Proof of Concept (POC) demonstrating real-time ingestion of Meta Lead Ads submissions via signed webhooks, asynchronous enrichment via the Meta Graph API, in-memory idempotent persistence, and live WebSocket streaming into a React Native (Expo) mobile application.

---

## 1. High-Level Architecture

```
[Meta Lead Ads]
      │
      │ 1. POST /webhook (x-hub-signature-256)
      ▼
[Webhook Server (Node/Express)] ── 2. Immediate 200 OK (Ack-then-process)
      │
      ├── 3. HMAC-SHA256 Timing-Safe Verification
      ├── 4. Idempotency Check (LeadStore.exists)
      ├── 5. Fetch full lead details (Graph API v19.0 with retry & backoff)
      ├── 6. Persist lead (LeadStore.save)
      └── 7. Broadcast "new-lead" event
               │
               ▼
       [Socket.IO Layer]
               │ (Live WebSocket stream)
               ▼
     [React Native App] ── On Launch: GET /leads (Hydrate-then-stream)
                        ── On Reconnect: GET /leads?since=<timestamp>
```

---

## 2. Key Architectural Decisions

1. **Ack-Then-Process**:
   - Meta requires fast HTTP `200 OK` responses (< 1s) to avoid aggressive retry storms.
   - The server verifies HMAC signature and acks `200 OK` immediately before fetching from the Graph API.
2. **Idempotency via `leadgen_id`**:
   - Meta may redeliver webhook payloads.
   - `LeadStore` uses `leadgen_id` as the primary key. Duplicates are silent no-ops, preventing duplicate DB writes and duplicate UI socket emits.
3. **Hydrate-Then-Stream**:
   - On app launch, the mobile app calls REST `GET /leads` to load existing leads, then opens a live Socket.IO connection for real-time deltas.
   - On connection drops, the app reconnects and resyncs via `GET /leads?since=<lastSeenTimestamp>`.

---

## 3. Project Structure

```
.
├── AGENTS.md                                # Project guidelines & agent constraints
├── meta-lead-ads-system-design.md           # System design specification
├── server/
│   ├── config/
│   │   └── env.js                           # Validates VERIFY_TOKEN, APP_SECRET, PAGE_ACCESS_TOKEN, PORT
│   ├── middleware/
│   │   └── rawBody.js                       # Captures raw request buffer for byte-accurate HMAC
│   ├── routes/
│   │   ├── webhook.js                       # GET /webhook (verification), POST /webhook (reception)
│   │   └── leads.js                         # GET /leads & GET /leads?since= (REST hydration)
│   ├── services/
│   │   ├── signature.js                     # HMAC-SHA256 signature calculation & verification
│   │   ├── leadStore.js                     # In-memory repository with Map keyed by leadgen_id
│   │   └── graphApi.js                      # Graph API v19.0 client with retry backoff & normalization
│   ├── realtime/
│   │   └── io.js                            # Socket.IO instance and emitNewLead helper
│   ├── __tests__/
│   │   ├── signature-test.js                # HMAC verification tests
│   │   ├── leadStore-test.js                # Idempotency & listing tests
│   │   ├── graphApi-test.js                 # Retry & normalization tests
│   │   ├── webhook-test.js                  # Immediate ack, challenge, and duplicate tests
│   │   └── e2e-simulation-test.js           # Full pipeline simulation test
│   ├── server.js                            # Express + Socket.IO bootstrap
│   ├── package.json
│   └── .env.example
└── app/
    ├── src/
    │   ├── types/
    │   │   └── lead.ts                      # Shared Lead data model & ConnectionStatus
    │   ├── services/
    │   │   └── api.ts                       # REST client wrapper with configurable SERVER_URL
    │   ├── hooks/
    │   │   ├── useLeadsQuery.ts             # Initial REST hydration & incremental refetch
    │   │   └── useLeadSocket.ts             # Socket.IO connection lifecycle & reconnect resync
    │   └── screens/
    │       └── LeadsScreen.tsx              # Presentation: Live status badge, FlatList, empty state
    ├── __tests__/
    │   ├── useLeadsQuery-test.ts            # Hydration hook unit tests
    │   │── useLeadSocket-test.ts            # Socket lifecycle & event tests
    │   └── LeadsScreen-test.tsx             # UI rendering & real-time prepend tests
    ├── App.tsx                              # App root entry point
    ├── babel.config.js
    ├── jest.config.js
    ├── tsconfig.json
    └── package.json
```

---

## 4. Running the Tests

### Backend Server Tests (5 test suites, 26 tests)
```bash
cd server
npm test
```
Verifies:
- HMAC-SHA256 signature verification (valid, invalid, tampered, malformed).
- `LeadStore` idempotency, deduplication, and chronological ordering.
- `graphApi` parameter contracts, field normalization, and retry backoff.
- Webhook `GET` challenge handshake and `POST` immediate 200 ack timing.
- Full end-to-end simulation from signed webhook to real-time client delivery.

### Mobile App Tests (3 test suites, 10 tests)
```bash
cd app
npm test
```
Verifies:
- `useLeadsQuery` REST hydration and incremental merge with deduplication.
- `useLeadSocket` lifecycle, connection status changes, and reconnect resync.
- `LeadsScreen` empty state, populated card list, status badge, and live prepending.

---

## 5. Running End-to-End Locally

### Terminal 1: Backend Server
```bash
cd server
cp .env.example .env
# Edit .env with your VERIFY_TOKEN, APP_SECRET, PAGE_ACCESS_TOKEN
npm start
```

### Terminal 2: Expose via Ngrok
```bash
ngrok http 3000
```
Update your Meta App Webhook Callback URL to `https://<ngrok-id>.ngrok-free.app/webhook` and verify token.

### Terminal 3: React Native App
```bash
cd app
npm start
```
Connect using Expo Go on iOS / Android or press `w` for Web preview.

---

## 6. Assumptions Made

1. **In-Memory Storage for POC**: As specified in §1.3 and §4.4 of the design, an in-memory Map behind the `LeadStore` interface is used for the POC. Swapping to SQLite or Postgres requires changing only `server/services/leadStore.js`.
2. **Meta Graph API Version**: Used Meta Graph API `v19.0` for retrieving lead data.
3. **Field Normalization**: Standard lead fields (`full_name`, `email`, `phone_number`) are normalized to top-level properties on `Lead`, while preserving full raw payload in `rawFieldData`.
4. **Unauthenticated Sockets for POC**: Consistent with §5 security design, client connects unauthenticated for the single-tenant demo.
