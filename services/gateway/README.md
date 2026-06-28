# API Gateway Service

Python + FastAPI service. Owns the public REST API, request validation, outbound webhook delivery, and OpenAPI spec generation.

Owned by: Dev C

Runs on port 8000 in local dev. Public-facing — this is what `@railswitch/node` and `railswitch` (Python SDK) talk to.

OpenAPI spec is auto-generated from Pydantic models at `/openapi.json`.
# triggered to verify auto-deploy
