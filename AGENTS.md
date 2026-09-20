# Project Rules

- Server code in /server, app code in /app. Never mix them.
- Follow the module boundaries in the system design doc exactly:
  routes/, services/, realtime/, middleware/ on the server;
  screens/, hooks/, services/, types/ on the app.
- Lead store must sit behind the LeadStore interface — no direct Map/array
  access from routes.
- HMAC signature must be computed over the RAW request body, not re-parsed JSON.
  Capture raw body via middleware before Express's json() parser transforms it.
- Webhook POST handler must respond 200 BEFORE the Graph API call resolves
  (ack-then-process). Never await the Graph API fetch before responding.
- Idempotency: use leadgen_id as the store's primary key; a duplicate delivery
  must be a silent no-op, not an error and not a duplicate emit.
- After writing or editing ANY file, run the relevant test suite before moving on:
  - Server change → `cd server && npm test`
  - App change → `cd app && npm test`
- Do not proceed to the next step until the current step's tests pass.
- If a test fails, fix the code (not the test, unless the test itself is wrong)
  and re-run. Repeat until green.
- Use TypeScript in /app. Plain JS with JSDoc types is fine in /server.
- Never commit secrets — .env is gitignored, .env.example lists required keys
  with placeholder values.
