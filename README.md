# RailSwitch
[![Engine CI](https://github.com/mayowa-sys/railswitch/actions/workflows/engine-ci.yml/badge.svg)](https://github.com/mayowa-sys/railswitch/actions/workflows/engine-ci.yml)
[![Gateway CI](https://github.com/mayowa-sys/railswitch/actions/workflows/gateway-ci.yml/badge.svg)](https://github.com/mayowa-sys/railswitch/actions/workflows/gateway-ci.yml)
[![Frontend CI](https://github.com/mayowa-sys/railswitch/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/mayowa-sys/railswitch/actions/workflows/frontend-ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
> **Recurring billing for a country where cards fail.**
**Stripe collects recurring revenue. RailSwitch recovers it.**
A multi-tenant subscriptions engine built on Nomba. When a card charge fails — which happens 20–30% of the time on Nigerian recurring payments — RailSwitch automatically cascades through smarter retries, a one-time virtual account, a USSD push, and a WhatsApp message until the customer pays. The subscription stays alive. The merchant keeps the revenue.
No payment processor anywhere — Stripe, Adyen, Razorpay, Paystack, Flutterwave — does this. We're not competing in a crowded category; we're inventing one.
Built for the [Nomba Hackathon 2026](https://devcareer.io/programs/nomba-hackathon) under the Subscriptions Engine track.
---
## The cascade
Card charge attempted
↓ fails
Smart retry (payday-aware, liquidity-aware backoff)
↓ exhausted
Virtual Account (amount-locked, one-time, expires)
↓ expires
USSD push (if Nomba supports it)
↓ times out
WhatsApp message (VA details + USSD + checkout link)
↓ grace period expires
Past due → eventual cancel
Each rail is independent. Each emits webhooks. The state machine guarantees one cycle, one charge — no double-billing even under concurrent webhook delivery.
See [`docs/architecture.md`](docs/architecture.md) for the full system design.
---
## Architecture at a glance
Two services, one shared Postgres database:
- **Engine** (`services/engine/`) — Node.js + TypeScript. XState v5 state machine, transactional wrapper, rail orchestrator, retry timing engine, multi-tenancy enforcement.
- **Gateway** (`services/gateway/`) — Python + FastAPI. Public REST API, request validation, OpenAPI generation, outbound webhook delivery.
Plus:
- `apps/dashboard` — Merchant dashboard (Next.js)
- `apps/portal` — Customer self-service portal (Next.js)
- `apps/storefront` — Demo storefront for live presentations
- `packages/sdk-node` — TypeScript SDK (`@railswitch/node`)
- `packages/sdk-python` — Python SDK (`railswitch` on PyPI)
---
## What's built
**Engine — pre-window foundation complete:**
- XState v5 subscription state machine — 11 states (incl. refunded), all transitions guarded, visualizable via `/debug/subscription-machine`
- Transactional wrapper — row-level locking, idempotent event processing, atomic audit logging
- Mock Nomba client + rail orchestrator scaffold — interface drives implementation
- Smart retry timing — payday-aware, liquidity-aware, deterministic for tests
- BillingHandler — bridges orchestrator to state machine (`bill()` + `retry()`), idempotent
- Internal API routes at `/internal/v1/*` — plans, customers, subscriptions, invoices, payment_methods CRUD
- Subscription state machine: cancel, pause, resume, preview (proration math), refund
- Drizzle production repository — FOR UPDATE, version checks, merchant isolation via `set_config()`
- `/status` endpoint with dependency probes
- Schema contract — locked column shapes wrapper depends on, migration 0007 adds 15 columns across 5 tables
- - 91 tests passing, all green in CI
**Window-phase work (July 1–7) — Nomba integration:**
- Day 1: Sandbox + Charge API + tokenized cards + webhook callback
- Days 2–4: Per-cycle VA generation, inbound webhook handlers, WhatsApp Cloud API, USSD (if available)
- Days 5–6: SDK publishing (`@railswitch/node` + `railswitch`), Mintlify docs, sandbox playground
- Day 7: Demo, submission
Per organizer rules, all Nomba integration code is authored July 1–7 on the `hackathon` branch. The `pre-hackathon-baseline` tag marks the cutoff. Judges can `git diff pre-hackathon-baseline hackathon` to see exactly what was built in the window.
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
| Gateway | `http://localhost:8000` | **Public API** — this is what merchants hit |
| Postgres | `localhost:5432` | Database (`dev`/`dev`/`railswitch`) |
| Redis | `localhost:6379` | BullMQ queue + rate limiting |
Verify both services are up:
```bash
curl http://localhost:8000/health
curl http://localhost:3001/health
curl http://localhost:3001/status
```
For day-to-day engine development with hot reload:
```bash
cd services/engine
npm install
npm run dev
```
(Postgres + Redis still need to be running via docker-compose.)
For the gateway:
```bash
cd services/gateway
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```
---
## Running tests
**Engine (vitest):**
```bash
cd services/engine
npm test
```
91 tests covering state machine transitions (all 11 states, 6 refund scenarios), wrapper guarantees (idempotency, row locking, rollback), retry timing math, mock Nomba + orchestrator cascade (including charge, VA, transfers, revoke), BillingHandler (bill + retry bridge), and internal API routes.
**Gateway (pytest):**
```bash
cd services/gateway
source .venv/bin/activate
pytest
```
**Full CI gate (run before pushing):**
```bash
# Engine
cd services/engine && npm run lint && npm run build && npm test
# Gateway
cd services/gateway && ruff check app/ && mypy app/ && pytest
```
---
## API
The public REST API lives at the gateway. Stripe-style conventions: `Authorization: Bearer sk_live_...`, `Idempotency-Key` header on writes, error envelope `{ data, error, meta }`, cursor pagination via `starting_after` / `ending_before`.
Plans
POST   /v1/plans
GET    /v1/plans
PATCH  /v1/plans/{id}
Subscriptions
POST   /v1/subscriptions
PATCH  /v1/subscriptions/{id}              # plan change with proration
POST   /v1/subscriptions/{id}/preview      # prorated invoice preview
POST   /v1/subscriptions/{id}/pause
POST   /v1/subscriptions/{id}/cancel
Invoices, customers, payment methods, webhooks
Full surface in docs/internal-api.md (internal) and docs.railswitch.dev (public, post-window)
OpenAPI spec is auto-generated by FastAPI from Pydantic models. Available at `http://localhost:8000/openapi.json` once the gateway is running.
---
## SDKs
Two SDKs covering the languages most Nigerian SaaS shops use:
**TypeScript (`@railswitch/node`):**
```typescript
import { RailSwitch } from "@railswitch/node";
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
Both publish to their respective registries on Day 5 of the hackathon window.
---
## Documentation
| Doc | What it is |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | System design — services, state machine, cascade, multi-tenancy, webhooks |
| [`docs/engine-schema-contract.md`](docs/engine-schema-contract.md) | Locked SQL contract the wrapper depends on |
| [`docs/internal-api.md`](docs/internal-api.md) | Internal HTTP contract between gateway and engine |
| Public API docs | [docs.railswitch.dev](https://docs.railswitch.dev) — Mintlify-hosted, auto-generated from OpenAPI (live post-window) |
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
MIT.
