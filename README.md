# RailSwitch

[![Engine CI](https://github.com/mayowa-sys/railswitch/actions/workflows/engine-ci.yml/badge.svg)](https://github.com/mayowa-sys/railswitch/actions/workflows/engine-ci.yml)
[![Gateway CI](https://github.com/mayowa-sys/railswitch/actions/workflows/gateway-ci.yml/badge.svg)](https://github.com/mayowa-sys/railswitch/actions/workflows/gateway-ci.yml)
[![Frontend CI](https://github.com/mayowa-sys/railswitch/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/mayowa-sys/railswitch/actions/workflows/frontend-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **Recurring billing for a country where cards fail.**
> **Stripe collects recurring revenue. RailSwitch recovers it.**

A multi-tenant subscriptions engine built on Nomba. When a card charge fails, RailSwitch automatically cascades through smarter retries, a one-time virtual account, a USSD push, and a WhatsApp message until the customer pays. The subscription stays alive. The merchant keeps the revenue.

Built for the [Nomba Hackathon 2026](https://devcareer.io/programs/nomba-hackathon) under the Subscriptions Engine track.

---

## The cascade

```
Card charge attempted
  ↓  fails
Smart retry (payday-aware, liquidity-aware backoff)
  ↓  exhausted
Virtual Account (amount-locked, one-time, expires)
  ↓  expires
USSD push (if Nomba supports it)
  ↓  times out
WhatsApp message (VA details + USSD + checkout link)
  ↓  grace period expires
Past due → eventual cancel
```

Each rail is independent. Each emits webhooks. The state machine guarantees one cycle, one charge — no double-billing even under concurrent webhook delivery.

See [`docs/architecture.md`](docs/architecture.md) for the full system design.

---

## Architecture at a glance

Two services, one shared Postgres database:

- **Engine** (`services/engine/`) — Node.js + TypeScript. XState v5 state machine, transactional wrapper, rail orchestrator, retry timing engine, multi-tenancy enforcement.
- **Gateway** (`services/gateway/`) — Python + FastAPI. Public REST API, request validation, OpenAPI generation, outbound webhook delivery.

Plus:

| App | Description |
|---|---|
| `apps/dashboard` | Merchant dashboard (Next.js) |
| `apps/portal` | Customer self-service portal (Next.js) |
| `apps/storefront` | Demo storefront for live presentations |
| `apps/docs` | Mintlify docs site |
| `packages/sdk-node` | TypeScript SDK (`railswitch` on npm) |
| `packages/sdk-python` | Python SDK (`railswitch` on PyPI) |

---

## What's built

**Engine — pre-window foundation complete (114 tests):**

- XState v5 subscription state machine — 12 states (incl. pending, refunded), all transitions guarded, visualizable via `/debug/subscription-machine`
- Transactional wrapper — row-level locking, idempotent event processing, atomic audit logging
- Mock Nomba client + rail orchestrator — interface-driven, 6 interval types (daily, weekly, monthly, annual, day-of-month, day-of-week)
- Smart retry timing — payday-aware, liquidity-window optimization, exponential backoff with jitter
- BillingHandler — bridges orchestrator to state machine (`bill()` + `retry()`), idempotent
- BullMQ billing scheduler with trial-to-paid conversion (requires Redis, dev-only until production Redis)
- Internal API routes at `/internal/v1/*` — plans, customers, subscriptions, invoices, payment methods, auth, webhooks CRUD
- Proration preview endpoint — plan-change proration (upgrade/downgrade), verified against brief example (₦3,333 credit / ₦10,000 charge / ₦6,667 net)
- Drizzle production repository — FOR UPDATE, version checks, merchant isolation via `set_config()`
- Immutable audit log with no-delete/no-update Postgres policies
- Outbound webhook delivery — HMAC-SHA256 signing, 9-step exponential backoff, replay support
- Inbound Nomba webhook ingress — signature verification (gateway), engine handler stub (window phase)

**Gateway — 14 tests:**

- Stripe-style REST API with `{ data, error, meta }` envelope
- Scoped API key auth + CORS + typed internal HTTP client
- 25+ documented endpoints with auto-generated OpenAPI spec
- Cursor pagination on all list endpoints
- Idempotency key enforcement on writes

**Frontend:**

- Merchant dashboard — 12 routes, auth context, plans + customers from real API (rest mock)
- Customer portal — 5 pages, recovery banner, proration preview (mock mode)
- Both with mock/real dual-mode via `NEXT_PUBLIC_MOCK_API`

**Window-phase work (July 1–7) — Nomba integration:**

- Day 1: Sandbox + Charge API + tokenized cards + webhook callback
- Days 2–4: Per-cycle VA generation, inbound webhook handlers, WhatsApp Cloud API, USSD (if available)
- Days 5–6: SDK publishing (`@railswitch/node` + `railswitch`), Mintlify docs, sandbox playground
- Day 7: Demo, submission

---

## Quickstart

**Requirements:** Docker Desktop, Node 20+, Python 3.12, Git.

```bash
git clone https://github.com/mayowa-sys/railswitch.git
cd railswitch
docker compose -f infra/docker-compose.yml up
```

Services boot at:

| Service | URL | Purpose |
|---|---|---|
| Engine | `http://localhost:3001` | Internal — state machine + business logic |
| Gateway | `http://localhost:8000` | **Public API** |
| Postgres | `localhost:5432` | Database (user `railswitch`, password `railswitch_dev`, db `railswitch`) |
| Redis | `localhost:6379` | BullMQ queue + rate limiting |

Verify:

```bash
curl http://localhost:8000/health
curl http://localhost:3001/health
curl http://localhost:3001/status
```

**Engine development (hot reload):**

```bash
cd services/engine && npm install && npm run dev
```

**Gateway development:**

```bash
cd services/gateway
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

**Dashboard:**

```bash
cd apps/dashboard && npm install && npm run dev
```

**Docs site:**

```bash
cd apps/docs && npx -p node@20 -- mintlify dev --port 3002
```

---

## Running tests

**Engine (vitest — 114 tests):**

```bash
cd services/engine && npm test
```

**Gateway (pytest — 14 tests):**

```bash
cd services/gateway && source .venv/bin/activate && pytest
```

**Full CI gate (run before pushing):**

```bash
# Engine
cd services/engine && npm run lint && npm run build && npm test

# Gateway
cd services/gateway && ruff check app/ && mypy app/ && pytest

# Dashboard
cd apps/dashboard && npm run lint && npm run build
```

**Integration test (hits all 27 endpoints live):**

```bash
bash test_integration.sh
```

---

## API

The public REST API lives at the gateway. Stripe-style conventions: `Authorization: Bearer sk_live_...`, `Idempotency-Key` header on writes, error envelope `{ data, error, meta }`, cursor pagination via `starting_after` / `ending_before`.

| Resource | Methods |
|---|---|
| Auth | `POST /v1/auth/register`, `POST /v1/auth/login` |
| Plans | `POST`, `GET list`, `GET by id`, `PATCH`, `DELETE` |
| Customers | `POST`, `GET list`, `GET by id` |
| Subscriptions | `POST`, `GET list`, `GET by id`, `PATCH`, pause, resume, cancel, preview |
| Invoices | `GET list`, `GET by id`, retry, refund |
| Payment Methods | `POST`, `GET list`, `GET by id`, `DELETE` |
| Webhooks | `POST /endpoints`, `GET list`, `GET by id`, `PATCH`, `DELETE`, events, deliveries, replay |

Full contract at [`docs/internal-api.md`](docs/internal-api.md). OpenAPI spec auto-generated at `http://localhost:8000/openapi.json`.

---

## SDKs

**TypeScript (`railswitch` on npm):**

```typescript
import { RailSwitch } from "railswitch";
const client = new RailSwitch({ apiKey: "sk_test_..." });
const subscription = await client.subscriptions.create({
  customerId: "cus_abc",
  planId: "plan_pro",
});
```

**Python (`railswitch`):**

```python
from railswitch import RailSwitch
client = RailSwitch(api_key="sk_test_...")
subscription = client.subscriptions.create(
    customer_id="cus_abc",
    plan_id="plan_pro",
)
```

Both published to their respective registries.

---

## Documentation

| Doc | What it is |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System design — services, state machine, cascade, multi-tenancy, webhooks |
| [`docs/engine-schema-contract.md`](docs/engine-schema-contract.md) | Locked SQL contract the wrapper depends on |
| [`docs/internal-api.md`](docs/internal-api.md) | Internal HTTP contract between gateway and engine |
| [`SECURITY.md`](SECURITY.md) | Auth model, RLS, PCI compliance, webhook security, threat model |
| [`apps/docs/`](apps/docs) | Mintlify docs site — quickstart, concepts, SDKs, webhooks, API reference |

---

## Team

| Dev | Owns |
|---|---|
| Daniel (@Amaryllis750) | Engine data layer: schema, billing cycles, proration, multi-tenancy, audit log |
| Mayowa (@mayowa-sys) | Rails: state machine, Nomba integration, multi-rail cascade, retry intelligence |
| Gbemi (@OluwagbeminiyiA) | Gateway, both SDKs, docs site, outbound webhooks, security note |
| Tomiwa (@moloruntomiwa31) | Frontend apps + demo storefront + demo video |

---

## Contributing

This is a hackathon project on a fixed timeline. The team is closed for the build window.

After Demo Day, contributions welcome. Workflow:

1. Branch from `main`: `git checkout -b your-feature`
2. Write code + tests
3. Run the CI gate locally (see [Running tests](#running-tests))
4. Open a PR, request review

CI must pass. Branch protection enforces it.

---

## License

MIT
