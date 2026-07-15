# API Gateway Service

Python + FastAPI service. Owns the public REST API, request validation, outbound webhook delivery, and OpenAPI spec generation.

Runs on port 8000 in local dev. Public-facing — this is what `@railswitch/node` and `railswitch` (Python SDK) talk to.

OpenAPI spec is auto-generated from Pydantic models at `/openapi.json`.

## Test Mode

Use API keys with the `sk_test_` prefix to operate in test mode.

### Test Payment Tokens

| Brand      | Last4 | Token              | Scenario |
|------------|-------|--------------------|----------|
| Visa       | 4242  | tok_test_visa_4242 | Success  |
| Visa       | 0002  | tok_test_visa_0002 | Decline  |
| Mastercard | 5100  | tok_test_mc_5100   | Success  |

## Endpoints

| Resource | Methods |
|---|---|
| Auth | `POST /v1/auth/register`, `POST /v1/auth/login` |
| Plans | `POST`, `GET list`, `GET by id`, `PATCH`, `DELETE` |
| Customers | `POST`, `GET list`, `GET by id` |
| Subscriptions | `POST`, `GET list`, `GET by id`, `PATCH`, pause, resume, cancel, preview |
| Invoices | `GET list`, `GET by id`, retry, refund |
| Payment Methods | `POST`, `GET list`, `GET by id`, `DELETE` |
| Webhooks | `POST /endpoints`, `GET list`, `GET by id`, `PATCH`, `DELETE`, events, deliveries, replay |
| Portal | `POST /v1/portal/token`, `GET /v1/portal/resolve` |
| Storefront | `POST /v1/storefront/checkout` |

## Running

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

## Tests

```bash
source .venv/bin/activate
pytest
```


