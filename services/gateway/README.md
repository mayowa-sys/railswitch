# API Gateway Service

Python + FastAPI service. Owns the public REST API, request validation, outbound webhook delivery, and OpenAPI spec generation.

Owned by: Dev C

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

Update the engine's test/dev seed data to include these tokens when available.
# triggered to verify auto-deploy
