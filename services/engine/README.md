# Engine Service

Node.js + TypeScript service. Owns the billing state machine, proration logic, multi-tenancy enforcement, and Nomba integration.

Owned by: Dev A (engine internals) + Dev B (Nomba rails)

Runs on port 3001 in local dev. Not publicly exposed — gateway calls it via internal HTTP.

See `docs/internal-api.md` for the HTTP contract this service exposes.
