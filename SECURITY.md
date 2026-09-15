# Security

RailSwitch handles recurring payment data across multiple merchants. This document describes our security model — what we protect, how we protect it, and what we deliberately avoid storing.

---

## Authentication & Authorization

### Merchant API keys

Merchants authenticate to the Gateway (public REST API) via `Authorization: Bearer sk_live_...` or `sk_test_...`. Keys are scoped to a single merchant and carry a mode (live/test). The Gateway validates keys against the `api_keys` table, extracts the `merchant_id`, and sets the Postgres session variable `app.current_merchant_id` so all downstream queries are RLS-scoped.

Malformed, unknown, or revoked keys receive `401 Unauthorized`.

### Internal Gateway ↔ Engine authentication

The Engine is unreachable from the public internet (Fly.io internal network only). The Gateway authenticates with a pre-shared secret passed via the `X-Internal-Auth` header. Without a matching secret, the Engine returns `401`. This is defense in depth: even if the Gateway is compromised, the Engine's attack surface is limited to the internal API contract.

### Idempotency

All mutation endpoints require an `Idempotency-Key` header. The Engine records successfully processed events in the `processed_events` table and returns the original response on replay, preventing double-execution under network retries.

---

## Multi-Tenant Isolation

### Row-Level Security (RLS)

Every table that holds merchant data has a `merchant_id` column and a PostgreSQL row-level security policy:

```sql
merchant_id = current_setting('app.current_merchant_id')::text
```

This policy is applied via `drizzle-orm/pg-core`'s `pgPolicy` on every schema table. The Gateway sets the session variable before any query runs. The Engine's DrizzleRepository reinforces this by calling `set_config('app.current_merchant_id', ...)` at connection time.

### What RLS prevents

- Merchant A's queries can never see, modify, or delete Merchant B's rows
- A compromised API key for Merchant A cannot leak Merchant B's customer data, subscriptions, invoices, or payment methods
- SQL injection, if it occurred, would still be bounded by the RLS scope

### Internal API enforcement

Every Engine route mounted under `/internal/v1/*` passes through `extractMerchantId` middleware, which reads `X-Merchant-Id` from the Gateway's request. The InMemoryRepository used in tests checks this explicitly. The DrizzleRepository enforces it at the database level.

---

## Data Handling & PCI Compliance

### What we do NOT store

RailSwitch never persists raw card numbers, CVV, PINs, or card expiry. All card data is tokenized by Nomba on the client side. We store only:

- A Nomba-generated card token (`card_token`)
- Last four digits of the card number for display
- Card brand / issuer for routing decisions

This keeps RailSwitch out of PCI DSS scope for cardholder data storage.

### What we DO store

| Data | Where | Protection |
|---|---|---|
| `card_token` (Nomba token) | `payment_methods` table | RLS-scoped, never exposed in public API responses |
| Customer name, email | `customers` table | RLS-scoped |
| Subscription state, billing amounts | `subscriptions` table | RLS-scoped, row-level locked during transitions |
| Invoice line items, amounts, currency | `invoices` table | RLS-scoped |
| Merchant API keys (live + test) | `api_keys` table | Hashed with `generateSecret()` before storage |
| Audit log entries | `audit_log` table | Append-only, RLS-scoped, no deletes or updates permitted |

### Data in transit

All traffic is encrypted via HTTPS (Fly.io enforces TLS, `force_https = true`). Internal Gateway ↔ Engine communication happens inside Fly's private network (`railswitch-engine.internal`) and does not traverse the public internet.

---

## Webhook Security

### Inbound webhooks (Nomba → RailSwitch)

Nomba sends payment notifications to the Gateway at `POST /webhooks/nomba`.

- **HMAC-SHA256 signature verification.** Nomba signs each payload with a shared secret configured on the Nomba dashboard. The Gateway recomputes the signature and compares using constant-time comparison (`hmac.compare_digest`).
- **Algorithm enforcement.** Only `HmacSHA256` is accepted. Unknown algorithms are rejected with `400`.
- **Timestamp validation.** The `nomba-timestamp` header is included in the signature payload, binding each request to a point in time.
- **Secret not stored in code.** `NOMBA_WEBHOOK_SECRET` is set as a Fly secret at deploy time and injected into the Gateway environment. It never appears in source files or version control.
- **Forwarding.** Verified payloads are forwarded synchronously to the Engine over the internal network with `X-Internal-Auth` (30s timeout). The Engine handler resolves the merchant from the Nomba sub-account ID in the payload and scopes all subsequent state transitions accordingly. Synchronous forwarding (changed from fire-and-forget `BackgroundTasks`) ensures webhooks are processed before the Gateway returns a response, preventing silent drops.

### Outbound webhooks (RailSwitch → merchants)

Merchants register webhook endpoints and signing secrets. RailSwitch delivers events with:

- **HMAC-SHA256 signing** via the `RailSwitch-Signature` header
- **Exponential backoff retry:** 0s, 30s, 2m, 10m, 30m, 2h, 5h, 10h, 24h — 9 total attempts before permanent failure
- **Replay endpoint** (`POST /v1/webhook_logs/{id}/replay`) for debugging
- All delivery attempts are logged to `webhook_delivery_attempts` for auditability

---

## Network Security

| Boundary | Protection |
|---|---|
| **Public → Gateway** | HTTPS (TLS 1.2+), CORS restricted to known origins |
| **Gateway → Engine** | Fly.io private network (`railswitch-engine.internal:3001`), shared secret auth |
| **Engine → Database** | Encrypted connection (Neon pooled URL over TLS), RLS enforcement |
| **Engine → Nomba** | HTTPS with Nomba's Client ID + HMAC-signed requests |
| **Engine → WhatsApp** | HTTPS with WhatsApp Cloud API access token |
| **Engine → Resend** | HTTPS with Resend API key for transactional emails |

The Engine has no public port binding. Fly configuration sets `handlers = []` on its port, making it unreachable from the internet.

---

## State Integrity

### Transactional state machine

Subscription state transitions are governed by an XState v5 state machine with 11 states and guarded transitions. The `SubscriptionWrapper` enforces consistency:

1. **Idempotency check.** For each event, the wrapper queries `processed_events` by `(subscription_id, event_id)`. If already processed, the original response is returned — no re-execution.
2. **Row-level lock.** The subscription row is loaded with `SELECT ... FOR UPDATE`, serializing concurrent transitions on the same subscription.
3. **Version check.** The wrapper validates `version` matches before persisting, providing optimistic concurrency control.
4. **Atomic audit log.** Audit entries are written in the same transaction as the state update. A failed transaction rolls back both.
5. **At-most-once charging.** The `charging → charge_result` transition checks `invoice.charge_attempts` before initiating a new Nomba charge.
6. **Cascade VA creation.** When a charge failure transitions to `va_fallback`, the webhook handler directly triggers `initiateVAFallback()` to create a real Nomba virtual account. The pending invoice is created before `CYCLE_BOUNDARY_REACHED` to satisfy the FK constraint on `current_invoice_id`.

### Immutable audit log

The `audit_log` table is append-only. No code path ever issues `UPDATE` or `DELETE` against it. Every state transition and payment event is recorded with `(subscription_id, event, timestamp, metadata)`.

---

## Secrets Management

| Secret | Storage | Scope |
|---|---|---|
| `INTERNAL_AUTH_SECRET` | Fly secret / docker-compose env | Gateway ↔ Engine |
| `NOMBA_WEBHOOK_SECRET` | Fly secret / docker-compose env | Nomba webhook verification |
| `DATABASE_URL` | Fly secret / docker-compose env | Engine + Gateway DB connection |
| Nomba Client ID + Private Key | Fly secret | Engine → Nomba API |
| Resend API Key | Fly secret | Engine → Resend email API |
| WhatsApp Cloud API Token | Fly secret | Engine → Meta WhatsApp API |
| `GEMINI_API_KEY` (optional) | Fly secret / docker-compose env | Engine → Google Gemini for AI dunning |
| Merchant webhook signing secrets | `webhook_endpoints` table | Per-merchant outbound signing |

Secrets are never committed to the repository. Local development uses a shared dummy secret (`dev-internal-secret-change-me`) set in `docker-compose.yml`. Production secrets are injected via `fly secrets set`.

---

## AI Feature Security

The engine ships three AI capabilities. Two run entirely offline; one sends a bounded subset of payment context to Google Gemini.

### Data sent to Gemini

Only these fields are included in the LLM prompt for AI dunning message generation:

- Customer **first name only** (the full name is split on the first whitespace, then trimmed)
- Plan name, currency, amount due
- Days overdue, retry count, cascade stage
- Virtual account number + bank name (already customer-visible)
- Portal payment link (already customer-visible)
- Optional merchant-supplied tone hint

The following are **never** sent to Gemini: customer email, phone number, full legal name, card token, card last-four, merchant API keys, internal IDs (subscription/customer/invoice), full DB rows.

### Output handling

LLM output is treated as untrusted user-generated content:

- Length caps (200 chars subject, 2000 chars body) — anything larger falls back to the template.
- HTML escaping via `escapeHtml()` in the email path before insertion into the mail body — the CTA button HTML is fixed by the template, never generated.
- WhatsApp message bodies are plain text over the Meta Cloud API; no rendering context that could execute markup.
- Missing/malformed JSON falls back to the template silently (logged at `warn` level).

### Disabling AI at the environment level

- `RAILSWITCH_AI_DUNNING=off` — disable LLM-generated messages entirely (all channels use templates).
- `RAILSWITCH_AI_RETRY=off` — disable the ML retry scorer (use the legacy payday/liquidity heuristic).
- Omitting `GEMINI_API_KEY` — equivalent to `RAILSWITCH_AI_DUNNING=off` for the LLM path; the churn/retry models still run because they're local.

### Failure isolation

The generator has an 8-second timeout, a try/catch around every fetch, and returns `null` on any error. The caller always passes a template fallback that is used verbatim on `null`. **No user-visible content path depends on the LLM being available.**

### What we did NOT do

- We do not fine-tune any model on customer data.
- We do not store LLM prompts or responses beyond structured log lines (subject length, generated flag, status code) for troubleshooting.
- We do not let LLM output influence state machine transitions, retry timing, or refund flows — only the free-form text in dunning messages.

---

## Threat Model

### Attacks we defend against

| Attack | Defense |
|---|---|
| **Cross-tenant data access** | PostgreSQL RLS on every merchant-scoped table; Gateway sets `app.current_merchant_id` per request; Engine's DrizzleRepository calls `set_config()` at connection time |
| **Replayed API requests** | Idempotency-Key enforcement on all mutation endpoints; `processed_events` table prevents double-execution |
| **Fake Nomba webhook** | HMAC-SHA256 signature verification with constant-time comparison; algorithm enforcement |
| **Compromised Gateway** | Engine is network-isolated (Fly internal only); separate auth secret; RLS still bounds any Engine query |
| **SQL injection** | Drizzle ORM parameterized queries; RLS provides an additional containment layer |
| **Double-charge** | State machine guarantees at-most-one charge per billing cycle; row-level lock serializes concurrent transitions |
| **Audit log tampering** | Audit log is append-only with no UPDATE/DELETE code paths |
| **Secrets in source** | All secrets injected via environment; `.env` and docker-compose files are gitignored or use dummy values |
| **Card data breach** | We never store raw card data; Nomba handles tokenization |
| **Sensitive PII leaking to LLM** | Only first name + non-sensitive payment context is sent to Gemini; email, phone, full name never included |
| **Malicious LLM output** | Length caps + HTML escaping + JSON schema validation; failure falls back to template silently |
| **LLM outage breaking payments** | AI dunning is best-effort with static-template fallback; no state-machine transition depends on the LLM |

### Attacks we accept as out of scope

| Attack | Rationale |
|---|---|
| **Gateway-level DDoS** | Mitigated by Fly.io's platform-level rate limiting; dedicated DDoS protection is post-MVP |
| **Physical database access** | Neon's managed Postgres provides physical security; we trust the cloud provider |
| **Nomba API compromise** | We depend on Nomba's own security posture for the charge API and payment processing |
| **Insider threat (team member)** | Hackathon scope — production RBAC would be added for a real deployment |

---

## Reporting a Vulnerability

This is a hackathon project. For the duration of the competition, security concerns should be raised directly with the team lead (Mayowa) or through the project's GitHub Issues.

After Demo Day, use GitHub's private vulnerability reporting if the repository enables it, or contact `mabdurrahman.balogun@gmail.com`.
