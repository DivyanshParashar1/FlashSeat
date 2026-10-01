# FlashSeat

High-concurrency event-ticketing API in TypeScript. Seat-level inventory with TTL holds, idempotent Razorpay checkout, webhook-driven booking finalization, and a Redis waiting-room queue for flash sales.

**Stack:** Fastify 5 · Drizzle ORM · PostgreSQL (Neon) · Razorpay · ioredis · Pino

## Features

- **Atomic seat holds** — pessimistic (`SELECT FOR UPDATE`) or optimistic (status-guard UPDATE) strategies, swappable via env.
- **TTL holds** with dual-layer expiry: lazy check on reads + background sweeper every 30s.
- **Idempotent reservations** via composite `(userId, idempotencyKey)` unique constraint.
- **Razorpay payments**: server-created Orders, HMAC-verified client callback, raw-body-verified webhooks, automatic refund on expiry race.
- **Admin endpoints** for event + bulk seat provisioning (grid-row spec).
- **SSE live seat updates** (`GET /events/:id/seat-updates`).
- **Redis waiting room** gating flash-sale reservations under contention.
- **Rate limiting** via `@fastify/rate-limit` with Redis-backed shared counters.
- **Observability**: UUID request IDs, slow-request logging, pino redacts for signatures & tokens.
- **Zero oversells** validated by k6 load test (500 VU, 50 seats).

## Architecture

```
                                 ┌──────────────────┐
                                 │  Razorpay        │
                                 │  (dashboard /    │
                                 │   webhooks)      │
                                 └────────┬─────────┘
                                          │ webhook (raw body + HMAC)
                                          ▼
┌────────┐   SSE   ┌─────────┐   HTTP   ┌─────────────────────────┐    ┌──────────────┐
│ Client │◄───────│ Fastify ├─────────►│  Services + Transactions │◄──►│  PostgreSQL  │
└────────┘         └────┬────┘          └────────────┬────────────┘    │   (Neon)     │
                        │ queue, rate-limit          │ hold / release  │  row-level   │
                        ▼                            ▼  / sweeper      │  locking,    │
                   ┌─────────┐             ┌──────────────────┐        │  MVCC        │
                   │  Redis  │             │ Background jobs  │        └──────────────┘
                   └─────────┘             │ (sweeper tick)   │
                                           └──────────────────┘
```

## Payment flow

1. User holds seats → `POST /events/:id/reservations` → 201 with `heldUntil` (8-min TTL)
2. User checks out → `POST /reservations/:id/checkout` → server creates Razorpay Order (idempotent by `reservation_id`)
3. Client opens Razorpay Checkout modal with `{ orderId, keyId }` → user pays
4. Modal callback → `POST /payments/verify` (signature verify, UX speedbump)
5. Razorpay webhook → `POST /webhooks/razorpay` with `payment.captured` → booking finalized (authoritative)
6. On expiry race (webhook arrives after hold expired) → auto-refund via `razorpay.payments.refund()`

## Key design decisions

- **Pessimistic & optimistic locking coexist** — swappable via `RESERVATION_LOCK_STRATEGY` env var. Side-by-side comparison for load testing (see [learning/interview_prep.md](learning/interview_prep.md)).
- **One payment per reservation** enforced by `UNIQUE(payments.reservation_id)` — makes checkout naturally idempotent, no separate idempotency key needed.
- **Webhook dedup via `processed_webhook_events`** PK on Razorpay event ID + `ON CONFLICT DO NOTHING` — at-least-once delivery handled at the DB layer.
- **Status collapse: user-cancelled → `expired`** (shared status enum; no `cancelled` value). Audit comes from `payments` + `bookings` rows.
- **Owner-check returns 404, not 403** — no information leak about reservation existence.
- **Raw-body preserved via plugin-scoped `addContentTypeParser`** for webhook route only; other routes keep default JSON parsing.

## Setup

```bash
pnpm install
cp .env.example .env  # fill in DATABASE_URL, JWT_SECRET, RAZORPAY_* keys
pnpm db:migrate
pnpm db:seed
pnpm dev
```

### Env vars

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Neon) |
| `JWT_SECRET` | Signs API JWTs |
| `JWT_EXPIRY` | Default `2h` |
| `RESERVATION_LOCK_STRATEGY` | `pessimistic` (default) or `optimistic` |
| `SWEEPER_INTERVAL_MS` | Hold-expiry sweeper tick (default 30000; set 0 to disable) |
| `RAZORPAY_TEST_KEY` / `RAZORPAY_TEST_KEY_SECRET` | API keys from dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret from dashboard |
| `REDIS_URL` | Optional. Enables rate-limit sharing + waiting-room queue when present |
| `LOG_LEVEL` | pino level, default `info` |
| `SLOW_REQUEST_MS` | Warn threshold for slow-request logging, default 500 |

## Running tests

```bash
pnpm test
```

Two integration tests:
1. **Golden path** — register → event → seats → hold → release → booking view
2. **No oversell** — 20 concurrent reservations on 1 seat → exactly 1 × 201, 19 × 409

## Load testing

See [loadtest/README.md](loadtest/README.md).

## Deploy to Cloud Run

```bash
gcloud run deploy flashseat \
  --source . \
  --region asia-south1 \
  --set-env-vars="RESERVATION_LOCK_STRATEGY=pessimistic,JWT_EXPIRY=2h" \
  --set-secrets="DATABASE_URL=flashseat-db:latest,JWT_SECRET=flashseat-jwt:latest,RAZORPAY_TEST_KEY=razorpay-key:latest,RAZORPAY_TEST_KEY_SECRET=razorpay-secret:latest,RAZORPAY_WEBHOOK_SECRET=razorpay-webhook:latest"
```

Secrets must be created in GCP Secret Manager first. Cloud Run reads them per deploy.

## Project layout

```
src/
├── app.ts                      Fastify setup, plugins, env schema
├── index.ts                    HTTP entry point
├── db/
│   ├── index.ts                Drizzle + Neon pool
│   └── schema/                 Table definitions
├── routes/                     Route plugins (one per domain)
├── controllers/                HTTP handlers
├── services/                   Business logic + transactions
├── lib/                        Shared utilities (razorpay, redis)
└── tests/                      node:test integration tests
drizzle/                        Generated migrations
learning/                       Design notes + interview prep
loadtest/                       k6 scripts + runbook
```
