## Project: RailSwitch

**Nomba Hackathon 2026 — Subscriptions Engine Track**

Positioning: "Stripe collects recurring revenue. RailSwitch recovers it."

A multi-tenant subscriptions engine on Nomba. When a recurring card charge fails (common in Nigeria), the system cascades through card retries → virtual account → USSD → WhatsApp until the customer pays. But the cascade is just the headline — we built a full Stripe Billing competitor with plans, proration, customer portal, audit log, SDKs, webhooks, and multi-tenant isolation.

---

## Architecture

```
Dashboard (Next.js) ──▶ Gateway (Python/FastAPI) ──internal──▶ Engine (Node.js/Express) ──▶ Postgres (Neon/Docker)
Portal (Next.js)     ──▶      port 8000                    ▶    port 3001
SDKs (TS + Python)   ──▶                                      
```

Two services, one shared Postgres. Gateway is public-facing. Engine is internal-only. Gateway never writes to engine tables — always forwards via internal HTTP with `X-Internal-Auth` + `X-Merchant-Id` headers.

**Deployment:** Fly.io. Gateway: `railswitch-gateway.fly.dev` (public). Engine: `railswitch-engine.internal:3001` (private Fly network). Database: Neon Postgres (EU-West-2). Redis: not deployed (BullMQ optional — engine starts without it).

**Local:** `docker compose -f infra/docker-compose.yml up` starts Postgres + Redis + Engine + Gateway. Dashboard and Portal run via `npm run dev` in their directories.

---

## Pre-Window Progress (June 21-29)

**96 commits, 77 in pre-window.**

### Gbemi — Gateway + SDKs + Docs (6/8 tasks done)

| Task | Status |
|------|--------|
| 1 — FastAPI scaffold + auth + HTTP client | ✅ Merged. auth.py (bearer token + key format regex), engine_client.py (typed httpx wrapper), CORS, lifespan |
| 2 — CRUD endpoints (plans, customers, subscriptions, invoices) | ✅ Merged. 25+ endpoints with Stripe envelope, cursor pagination, idempotency |
| 3 — Preview + payment methods | ✅ Merged. Preview with proration math, payment method CRUD, 10 integration tests |
| 4 — Outbound webhooks | ✅ Mayowa built it. HMAC-SHA256 signing, 9-step exponential backoff, replay, webhook_endpoints/events/deliveries tables |
| 5 — SDK skeletons | ✅ Mayowa built it. TypeScript + Python, typed clients |
| 6 — Docs site (Mintlify) | ✅ Merged. 14 files, quickstart, concepts, webhooks, SDKs, test cards. Preview with `npx -p node@20 -- mintlify dev` in apps/docs/ |
| 7 — Publish SDKs | 🔒 Window phase (Day 5) |
| 8 — Finalize docs | 🟡 SECURITY.md + architecture.md done. Docs site needs content fixes (cascade page shows email stages instead of our actual 3-rail cascade) |

### Mayowa — Rails + Nomba (3/3 pre-window done + extras)

| Task | Status |
|------|--------|
| State machine | ✅ XState v5, 11 states (incl. refunded), guarded transitions, visualizable |
| Mock Nomba + orchestrator | ✅ Interface-driven, failure injection via idempotency key |
| Retry timing engine | ✅ Payday-aware, liquidity-window WAT, exponential backoff |
| Internal API routes | ✅ All CRUD for plans, customers, subs, invoices, payment methods, auth |
| BillingHandler | ✅ `bill()` + `retry()` bridge orchestrator to state machine |
| DrizzleRepository | ✅ FOR UPDATE, set_config() for RLS, version checks |
| Auth (login/register) | ✅ bcrypt hashing, API key generation with sha256, key format `sk_test_mer_ID__random` |
| Webhook ingress | ✅ Nomba HMAC-SHA256 verification at gateway, forwarding to engine |
| SECURITY.md | ✅ RLS, PCI, threat model |
| Frontend auth | ✅ AuthContext + AuthGuard, mock/real dual mode |
| API key format fix | ✅ Double underscore `__` separates merchant_id from random chars in keys |

### Daniel — Engine Data Layer (2/4 tasks done)

| Task | Status |
|------|--------|
| 1 — DB schema + RLS | ✅ Merged. 12 tables, RLS policies on all |
| 2 — Billing cycle engine | ✅ Merged (Mayowa completed — all 6 intervals, trial-to-paid, retry timing) |
| 3 — Proration subsystem | ⚠️ Math exists in preview route, but not a proper module with 5 scenarios |
| 4 — Cross-tenant tests | ❌ Not started |

### Tomiwa — Frontend (1.5/4 tasks done)

| Task | Status |
|------|--------|
| Dashboard scaffold + auth | ✅ AuthContext built by Mayowa. Tomiwa built 12 routes, landing page, mock data |
| Core tabs + audit log | ✅ All 5 tabs built, mock data, audit log with live polling |
| Customer portal | ✅ 5 pages, recovery banner, proration preview, localStorage state |
| Dashboard API wiring | ⚠️ Plans + customers wired to real API. Subscriptions, overview, audit log still use mock data |
| Demo storefront | ❌ README only |
| Demo video | ❌ Window phase |

---

## Key Facts for New Chat

**Test counts:** Engine 114 (vitest), Gateway 14 (pytest), Dashboard builds (lint + build pass).

**CI:** 3 workflows — engine-ci.yml (lint+build+test+deploy), gateway-ci.yml (ruff+mypy+pytest+deploy), frontend-ci.yml (lint+build). Engine deploy has `continue-on-error: true` because Fly TCP machines don't auto-start after deploy.

**How to run everything:**

```bash
# Terminal 1 — DB + Redis
docker compose -f infra/docker-compose.yml up postgres redis

# Terminal 2 — Engine
cd services/engine && npm run dev

# Terminal 3 — Gateway
cd services/gateway && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 4 — Dashboard
cd apps/dashboard && npm run dev

# Terminal 5 — Docs (optional)
cd apps/docs && npx -p node@20 -- mintlify dev --port 3002
```

**Integration test:** `bash test_integration.sh` — 27/27 passes. Self-contained, unique email each run.

**API key format:** `sk_test_mer_MERCHANTID__RANDOMCHARS` — double underscore separates merchant ID from random. Gateway regex: `r"^sk_(live|test)_(.+?)__[A-Za-z0-9_-]{8,}$"`. Engine generates with `generateApiKey(merchantId, mode)`.

**Known gaps (not blocking):**
- Dashboard subscriptions/overview/audit pages still use mock data
- Daniel's billing worker polls the wrong field for retries (should check `invoices.next_attempt_at`, currently sets both `subscriptions.next_billing_at` and `invoices.next_attempt_at` to same value)
- Cascade docs page in Mintlify shows email/SMS stages instead of our actual 3-rail cascade
- No Redis in production (engine starts without it, billing worker won't run)
- Dashboard .env.local has `NEXT_PUBLIC_MOCK_API=false` (now real API mode)

**Window phase (July 1-7):**
- Day 1: Nomba sandbox + Charge API (Mayowa)
- Day 2-4: VA generation + webhook handler + WhatsApp (Mayowa)
- Day 5: Publish SDKs to npm + PyPI (Gbemi)
- Day 6: Dashboard wiring + demo storefront (Tomiwa)
- Day 7: Demo video + submission (Tomiwa/team)

**Important files:**
- `services/engine/src/state-machines/subscription.ts` — XState machine
- `services/engine/src/wrapper/subscription-wrapper.ts` — transactional wrapper
- `services/engine/src/rails/billing-handler.ts` — orchestrator bridge
- `services/engine/src/rails/nomba-client.ts` — NombaClient interface
- `services/engine/src/workers/billing.worker.ts` — BullMQ worker
- `services/engine/src/routes/` — all engine endpoints
- `services/gateway/app/engine_client.py` — typed httpx wrapper
- `services/gateway/app/routes/` — all gateway endpoints
- `services/gateway/app/auth.py` — API key auth middleware
- `apps/dashboard/lib/auth-context.tsx` — AuthContext
- `apps/dashboard/lib/api-client.ts` — typed fetch wrapper
- `docs/internal-api.md` — internal API contract
- `docs/architecture.md` — system architecture
- `SECURITY.md` — security model
- `test_integration.sh` — 27-endpoint integration test
