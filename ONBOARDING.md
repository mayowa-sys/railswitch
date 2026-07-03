# RailSwitch — Project Overview

**Nomba Hackathon 2026 — Subscriptions Engine Track**

> "Stripe collects recurring revenue. RailSwitch recovers it."

A multi-tenant subscriptions engine on Nomba. When a recurring card charge fails, the system cascades through card retries → virtual account → USSD → WhatsApp until the customer pays.

---

## Architecture

```
Dashboard (Next.js) ──▶ Gateway (Python/FastAPI) ──internal──▶ Engine (Node.js/Express) ──▶ Postgres
Portal (Next.js)     ──▶      port 8000                    ▶    port 3001
SDKs (TS + Python)   ──▶
```

Two services, one shared Postgres. Gateway is public-facing. Engine is internal-only.

**Deployment:** Fly.io. Gateway: `railswitch-gateway.fly.dev` (public). Engine: internal network. Database: Postgres.

**Local:** `docker compose -f infra/docker-compose.yml up` starts Postgres + Redis.

---

## Test Counts

| Component | Framework | Count |
|---|---|---|
| Engine unit tests | vitest | 96 |
| Engine cross-tenant | vitest | 5 |
| Integration tests | bash | 113 |
| Gateway | pytest | suite |

---

## How to Run

```bash
# Terminal 1 — DB + Redis
docker compose -f infra/docker-compose.yml up postgres redis

# Terminal 2 — Engine
cd services/engine && npm run dev

# Terminal 3 — Gateway
cd services/gateway && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Terminal 4 — Dashboard
cd apps/dashboard && npm run dev

# Seed demo data
python3 scripts/seed-demo.py
```

---

## Key Files

| File | Purpose |
|---|---|
| `services/engine/src/state-machines/subscription.ts` | XState v5 machine |
| `services/engine/src/wrapper/subscription-wrapper.ts` | Transactional wrapper |
| `services/engine/src/rails/billing-handler.ts` | Orchestrator bridge |
| `services/engine/src/middleware/rls.ts` | RLS context middleware |
| `services/engine/tests/tenants/cross_tenant_test.test.ts` | Cross-tenant isolation |
| `services/gateway/app/auth.py` | API key auth |
| `services/gateway/app/engine_client.py` | Typed HTTP client |
| `docs/architecture.md` | System design |
| `SECURITY.md` | Security model |
| `test_integration.sh` | 113-endpoint integration test |

---

## API Key Format

`sk_test_mer_MERCHANTID__RANDOMCHARS` — double underscore separates merchant ID from random. Gateway regex: `r"^sk_(live|test)_(.+?)__[A-Za-z0-9_-]{8,}$"`.
