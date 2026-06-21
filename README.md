# RailSwitch

> Recurring billing for a country where cards fail.

**Stripe collects recurring revenue. RailSwitch recovers it.**

A multi-tenant subscriptions engine built on Nomba. When a card charge fails — which happens 20–30% of the time on Nigerian recurring payments — RailSwitch automatically cascades through virtual account transfers, USSD, and WhatsApp until the customer pays. The subscription stays alive. The merchant keeps the revenue.

Built for the [Nomba Hackathon 2026](https://devcareer.io/programs/nomba-hackathon) under the Subscriptions Engine track.

## Architecture

Two services, one shared Postgres database:

- **Engine** (`services/engine/`) — Node.js + TypeScript. State machine, billing logic, proration, multi-tenancy, Nomba integration.
- **Gateway** (`services/gateway/`) — Python + FastAPI. Public REST API, request validation, outbound webhook delivery.

Plus:

- `apps/dashboard` — Merchant dashboard (Next.js)
- `apps/portal` — Customer self-service portal (Next.js)
- `apps/storefront` — Demo storefront for live presentations
- `packages/sdk-node` — TypeScript SDK (`@railswitch/node`)
- `packages/sdk-python` — Python SDK (`railswitch` on PyPI)

See [`docs/architecture.md`](docs/architecture.md) for the full picture.

## Local development

Requires Docker Desktop, Node 20+, Python 3.12, and Git.

```bash
git clone https://github.com/mayowa-sys/railswitch.git
cd railswitch
docker compose -f infra/docker-compose.yml up
```

Services boot at:
- Engine: `http://localhost:3001`
- Gateway: `http://localhost:8000` (this is the public API)
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Team

| Dev | Owns |
|---|---|
| A | Engine internals: state machine, billing cycles, proration, multi-tenancy, audit log |
| B | Rails: Nomba integration, multi-rail cascade, retry intelligence |
| C | Gateway, both SDKs, docs site, outbound webhooks, security note |
| D | Frontend apps + demo storefront + demo video |

## License

MIT
