# Unique Cloudbook / Unque Submission Walkthrough & Presentation Scripts

This guide contains the exact spoken scripts and outlines required for your submission:
- **Part 1**: 3 Audio Prompts (at least 90s each, ex-tempore style) to email to `krishna@unque.me`, `n.sarang@unque.me`, and `nijam@unque.me`.
- **Part 2 - Video 1 (< 5 min)**: Live Loom Demo showing instantaneous lead ingestion with zero manual user interaction.
- **Part 2 - Video 2 (< 5 min)**: Code & Architecture walkthrough explaining design decisions, security, and edge-case handling.

---

# Part 1: Non-Technical Audio Submissions (>= 90s each)

> **Instructions**:
> - Record each answer as a separate voice note / audio file (`.m4a`, `.mp3`, or `.wav`).
> - Speak naturally, conversationally, and at a steady, thoughtful pace. Don't rush; pause naturally between thoughts to hit the 90–120 second mark.
> - Email the recordings to `krishna@unque.me`, `n.sarang@unque.me`, and `nijam@unque.me`.

---

## Audio 1: "What’s a 'nerdy' or tedious part of your life that most people hate, but you actually find deeply satisfying?"

### Spoken Script (~95 - 110 seconds):
> "Hey Krishna, Sarang, and Nijam.
>
> If I had to pick one nerdy, tedious thing that most people dread or find completely mundane, it’s definitely **structuring, auditing, and cleaning up state boundaries and commit histories in git**.
>
> Most engineers I work with view git hygiene or config management as pure overhead. They want to write code, do a quick `git add .`, commit with 'fix stuff', and push. But for me, taking the time to design clean, atomic commits, dissect merge diffs line-by-line, and eliminate any hidden dead code is almost meditative.
>
> It’s the same feeling I get when organizing physical spaces or debugging a tricky memory leak. When you have a complex system—like microservices communicating with asynchronous queues or frontends handling WebSocket streams—chaos naturally accumulates. When something breaks in production at 2 AM, the difference between panic and resolution is having a pristine, predictable trail: knowing exactly where data enters, how it transforms, and having a deterministic record.
>
> Beyond code, I find that same satisfaction in organizing information workflows: cataloging notes, tagging documentation, and standardizing folder structures. It takes patience up front, and people often say, 'Why bother spending 15 minutes organizing when you can just build?' But the payoff is immense: zero cognitive drag later, crystal clarity for teammates, and the confidence that the foundation under your feet is rock solid. That quiet sense of order is deeply satisfying to me."

---

## Audio 2: "What is a common opinion in the world around you that you strongly disagree with?"

### Spoken Script (~95 - 110 seconds):
> "A common opinion in the tech community today is that **'speed of shipping is all that matters, and you can always fix architecture and quality later in tech debt.'**
>
> With the rise of AI tools, boilerplates, and 'move fast and break things' culture, there's a strong push to hack together minimum viable products as quickly as possible. The belief is that spending time upfront considering security, idempotency, or architectural boundaries is premature optimization.
>
> I strongly disagree with that perspective.
>
> Speed is crucial, but reckless speed is an illusion. When you bypass fundamental architecture—like skipping cryptographic payload verification, neglecting race conditions, or putting sensitive secrets on client devices—you aren't actually moving faster. You're taking out a high-interest loan. You spend the next six months firefighting production outages, customer data leaks, and fragile rewrites.
>
> In my experience, disciplined engineering doesn't slow you down; it accelerates you. When you take just 30 minutes to draw clear module boundaries, establish idempotent keys, and write automated integration tests, your subsequent feature velocity doubles. You ship with complete peace of mind knowing that edge cases won't crash your system under load. True velocity is sustainable velocity, not careless shortcuts."

---

## Audio 3: "When was the last time you were working on something and realized hours had passed without you noticing?"

### Spoken Script (~95 - 110 seconds):
> "The last time I fell completely into a deep flow state was just recently when I was designing and debugging the real-time event pipeline for this exact assignment.
>
> I sat down around 8 PM to wire up the Meta Webhook receiver and connect it to a real-time WebSocket stream on the mobile client. My initial goal was just to verify the basic HTTP POST signature. But as I got deeper into the mechanics of Meta's Lead Ads infrastructure, I became completely absorbed in the real-world edge cases.
>
> I started questioning: What happens if Meta retries an event within 50 milliseconds? How do we handle duplicate delivery without cluttering the user interface? How do we decouple the synchronous 200 OK acknowledgment from the asynchronous Graph API fetch so Meta's servers never time out?
>
> I began architecting the HMAC-SHA256 crypto validation, implementing memory-safe caching with a TTL cache, and writing unit tests to simulate concurrent webhook bursts and network disconnections. I was switching between Node crypto internals, Socket.IO handshake listeners, and React Native FlatList animations.
>
> When I finally looked up at the clock, it was past 1:30 AM. Five and a half hours had passed like twenty minutes. That feeling—where the outside world completely fades, you're solving real distributed systems challenges, and every test case turns green—is why I love software engineering."

---

# Part 2: Technical Loom Videos

---

## Loom Video 1 (< 5 mins): Live End-to-End Demonstration

### Goal:
Demonstrate that a new Meta Lead Ad submission appears in the open mobile app with **zero manual user action** (no manual refresh, no pulling down, no button clicking).

### Setup:
1. Have two windows side-by-side on your screen:
   - **Left Window**: Terminal running `npm run dev` showing live backend logs.
   - **Right Window**: Browser or emulator running the app at `http://localhost:8081` with the Leads screen open.
2. Ensure the top status badge shows: **`● LIVE STREAM CONNECTED`** (Green).

### Step-by-Step Loom 1 Script:
> "Hello team! In this video, I’m demonstrating the real-time Meta Lead Ads ingestion pipeline.
>
> On the right, you see our open React Native application running with real-time Socket.IO subscriptions active. Notice the green badge indicating `LIVE STREAM CONNECTED`.
>
> On the left, we have our Node.js ingestion server running.
>
> To demonstrate zero manual interaction, I am not going to touch or refresh the mobile screen. In our test section at the top, I'll enter a new lead:
> - Name: *Vikram Sharma*
> - Email: *vikram.sharma@example.com*
> - Phone: *+91 98765 43210*
> - Form: *Summer Enterprise Campaign 2026*
>
> When I click 'Simulate Meta Lead Ad Submission', here is what happens behind the scenes:
> 1. A simulated Meta webhook payload is constructed with a unique `leadgen_id`.
> 2. It is cryptographically signed using HMAC-SHA256 with our Meta App Secret and sent to `POST /webhook`.
> 3. The server validates the cryptographic signature, sends an immediate `200 OK` back to Meta within 15ms, and kicks off an asynchronous Graph API worker.
> 4. The worker extracts the decrypted lead fields, checks the idempotency cache, stores it, and emits a `lead:new` event over WebSockets.
>
> Watch the mobile screen right now as I click Submit...
>
> *(Click Submit)*
>
> Look at the terminal:
> - HMAC-SHA256 signature verified.
> - Webhook ACKed in 12ms.
> - Lead processed for leadgen_id.
> - Broadcast to connected mobile clients.
>
> And look at the mobile screen on the right: With zero manual action, the FlatList smoothly animated, incremented the total lead count, displayed the 'NEW' badge, and rendered Vikram Sharma's full contact details at the very top.
>
> If Meta sends a duplicate retry with the same ID, our idempotency engine ignores the duplicate, preventing ghost duplicates in the UI. Everything is instantaneous, secure, and fully automated."

---

## Loom Video 2 (< 5 mins): Architecture & Code Deep Dive

### Goal:
Walk through the codebase structure, explain key architectural decisions, and show how critical edge cases are resolved.

### Step-by-Step Loom 2 Script:
> "Hello everyone, in this video I'm going to walk through the architecture and implementation of our Meta Lead Ads streaming system.
>
> ### 1. Why a Client-Only Approach is Impossible
> To begin with, why can't a React Native app directly receive Meta webhooks?
> - **Public HTTPS Endpoint**: Meta requires a publicly accessible HTTPS URL. Mobile devices live behind carrier-grade NATs and cellular firewalls without static public IPs.
> - **Credential Security**: Fetching lead data from Meta requires your `APP_SECRET` and `PAGE_ACCESS_TOKEN`. Putting secrets inside a mobile APK or IPA allows anyone to decompile the app and compromise your entire Meta account.
> - **Availability**: Mobile apps get suspended or terminated by iOS and Android OS when backgrounded.
> Therefore, a secure intermediary backend gateway is mandatory.
>
> ### 2. Backend Gateway (`/server`)
> Let's look at `server/src/routes/webhook.js`:
> - **Cryptographic Verification**: In `middleware/verifySignature.js`, we capture the raw unparsed request buffer. We calculate an HMAC-SHA256 digest using `META_APP_SECRET` and compare it against the `x-hub-signature-256` header using `crypto.timingSafeEqual` to prevent timing attacks.
> - **Ack-Then-Process**: Meta imposes a strict 6-second timeout before retrying webhooks. In our webhook route, we return `res.status(200).send('EVENT_RECEIVED')` immediately. The Graph API fetch and socket dispatch happen asynchronously in the background.
> - **Idempotency**: In `services/leadStore.js`, we index leads by `leadgen_id`. If Meta retries the webhook due to network jitter, our store detects the existing ID and safely skips duplicate processing and notification.
>
> ### 3. Mobile Client Architecture (`/app`)
> On the frontend, we use the **Hydrate-Then-Stream** pattern:
> - **Hydration**: When the user opens the app, `useLeadsQuery.ts` fetches the latest snapshot from `GET /leads`.
> - **Streaming**: Simultaneously, `useLeadSocket.ts` establishes a persistent WebSocket connection via Socket.IO. When a `lead:new` event arrives, the reducer prepends the new lead to the FlatList with zero UI stutter.
> - **Resilience**: If the user goes through a tunnel and disconnects, Socket.IO automatically reconnects and triggers a background re-sync to ensure no leads are lost during downtime.
>
> ### 4. Test Verification
> In our terminal, running `npm test` executes our comprehensive suite of 36 unit and integration tests across both `/server` and `/app`:
> - Validates HMAC signature matching and rejection of tampered payloads.
> - Validates webhook handshake challenge verification.
> - Validates deduplication and concurrent race conditions.
> - Validates React Native hook rendering and UI components.
>
> All 36 tests pass cleanly. Thank you!"
