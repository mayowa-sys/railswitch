# Engine Schema Contract

**Status:** Authoritative. The state machine and the subscription wrapper depend on the shapes below. Deviations break the engine.

**Audience:** Daniel (schema author) primarily, but anyone touching engine tables should read this.

---

## Why this file exists

The state machine (`services/engine/src/state-machines/subscription.ts`) and the transactional wrapper (`services/engine/src/wrapper/subscription-wrapper.ts`) are merged. They depend on specific column names, value sets, and JSONB shapes. The wrapper has 12 passing tests against an in-memory repository that satisfies the `SubscriptionRepository` interface (`services/engine/src/wrapper/repository.ts`). When the Drizzle repository is written against this schema, those same tests must pass against Postgres — that's the integration gate for July 1.

If your schema doesn't satisfy what's specified here, the Drizzle repository won't compile, and the engine won't be able to process a single subscription event. Read this carefully.

---

## Hard contracts (lock these)

### 1. `subscriptions.state`

A text (or enum) column with exactly these values, lowercase, underscore-separated:
pending

trialing

active

charging

retrying

va_fallback

ussd_fallback

whatsapp_fallback

paused

past_due

cancelled

These are the state names emitted by the state machine. The wrapper reads `state` from the row, hydrates the actor at that state, sends an event, reads the resulting state name, writes it back. Any other value crashes the wrapper.

Recommended SQL:
```sql
CREATE TYPE subscription_state AS ENUM (
  'pending', 'trialing', 'active', 'charging', 'retrying',
  'va_fallback', 'ussd_fallback', 'whatsapp_fallback',
  'paused', 'past_due', 'cancelled'
);
```

### 2. `subscriptions.version`

Integer column, `NOT NULL DEFAULT 1`. Incremented on every successful persist.

The wrapper passes `expectedVersion` to `repo.persist(...)`. If the row's version doesn't match, the repo must throw `StaleVersionError`. This is defense in depth on top of `SELECT ... FOR UPDATE`.

### 3. `subscriptions` context columns

The state machine's `SubscriptionContext` has these fields. They must be persisted such that the Drizzle repository can reconstruct a `SubscriptionContext` from a row read.

| TypeScript field         | SQL column                  | Type                  | Nullable | Notes |
|--------------------------|-----------------------------|-----------------------|----------|-------|
| `subscriptionId`         | `id`                        | TEXT (PK)             | No       | Format: `sub_<random>` |
| `merchantId`             | `merchant_id`               | TEXT                  | No       | FK → `merchants.id` |
| `customerId`             | `customer_id`               | TEXT                  | No       | FK → `customers.id` |
| `planId`                 | `plan_id`                   | TEXT                  | No       | FK → `plans.id` |
| `policy`                 | `policy`                    | JSONB                 | No       | See DunningPolicy shape below |
| `retryCount`             | `retry_count`               | INTEGER               | No       | DEFAULT 0 |
| `lastFailureReason`      | `last_failure_reason`       | TEXT                  | Yes      | |
| `lastFailureRetryable`   | `last_failure_retryable`    | BOOLEAN               | Yes      | |
| `vaId`                   | `va_id`                     | TEXT                  | Yes      | |
| `vaExpiresAt`            | `va_expires_at`             | TIMESTAMPTZ           | Yes      | Store as TIMESTAMPTZ in SQL; the wrapper serializes to/from ISO strings |
| `currentInvoiceId`       | `current_invoice_id`        | TEXT                  | Yes      | FK → `invoices.id` (nullable) |

Plus:
- `state` — see contract 1
- `version` — see contract 2
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Index on `(merchant_id, state)` — the dashboard queries subscriptions by state per merchant. Index on `(merchant_id, current_invoice_id)` for joins.

### 4. `audit_log`

Append-only. Written inside the same transaction as `subscriptions.persist`. The wrapper writes exactly the shape below.

| TypeScript field   | SQL column         | Type        | Nullable |
|--------------------|--------------------|-------------|----------|
| `merchantId`       | `merchant_id`      | TEXT        | No       |
| `subscriptionId`   | `subscription_id`  | TEXT        | No       |
| `fromState`        | `from_state`       | TEXT        | No       |
| `toState`          | `to_state`         | TEXT        | No       |
| `actor`            | `actor`            | TEXT (enum) | No       |
| `reason`           | `reason`           | TEXT        | No       |
| `timestamp`        | `timestamp`        | TIMESTAMPTZ | No       |

Plus an `id` column (UUID or BIGSERIAL — your call) as primary key.

`actor` column allowed values: `'system' | 'merchant' | 'customer'`. Recommend a CHECK constraint or enum type.

Index on `(merchant_id, subscription_id, timestamp DESC)` — the audit log viewer pages backwards through history per subscription. This is a depth signal we're shipping; the query must be fast.

**No UPDATE or DELETE on this table.** RLS can read-only-protect it if you want belt-and-braces.

### 5. `processed_events`

Idempotency cache. The wrapper checks this at the start of `processEvent` and short-circuits replays. Without this table the engine cannot handle duplicate webhook deliveries — which Nomba *will* send.

| Column              | Type        | Nullable | Notes |
|---------------------|-------------|----------|-------|
| `id`                | BIGSERIAL   | No       | PK |
| `merchant_id`       | TEXT        | No       | FK → `merchants.id`, also for RLS scoping |
| `subscription_id`   | TEXT        | No       | FK → `subscriptions.id` |
| `idempotency_key`   | TEXT        | No       | From inbound webhook or request |
| `cached_state`      | TEXT        | No       | The state value at the time of caching |
| `cached_context`    | JSONB       | No       | Serialized SubscriptionContext for replay |
| `created_at`        | TIMESTAMPTZ | No       | DEFAULT now() |

**Unique constraint:** `UNIQUE (subscription_id, idempotency_key)`. The wrapper relies on this for cache lookup.

Index on `(merchant_id, subscription_id, created_at DESC)` for debugging — operators want to see "what events have we processed for this subscription."

### 6. DunningPolicy JSONB shape

The `subscriptions.policy` JSONB column must deserialize to this exact shape:

```json
{
  "maxRetries": 3,
  "ussdEnabled": true,
  "graceHours": 72,
  "baseDelayMinutes": 60,
  "maxDelayHours": 72
}
```

All fields required. camelCase keys (matches the TypeScript interface — the wrapper does not rename). Validate on write with a CHECK or a Drizzle Zod schema.

Default policy when a subscription is created:
```json
{
  "maxRetries": 3,
  "ussdEnabled": true,
  "graceHours": 72,
  "baseDelayMinutes": 60,
  "maxDelayHours": 72
}
```

---

## Soft contracts (your judgment, but coordinate)

These tables don't have wrapper-level constraints, but their shapes affect Gbemi's gateway. Match the JSON conventions in `docs/internal-api.md` (snake_case JSON, prefixed string IDs).

### `merchants`
- `id` TEXT PK, format `mer_<random>`
- `name`, `created_at`, plus whatever's useful

### `api_keys`
- `id` TEXT PK, format `ak_<random>`
- `merchant_id` FK
- `key_hash` (NEVER store the raw key)
- `key_prefix` for display, e.g. `sk_test_abc...`
- `type` enum (`live` | `test`)
- `revoked_at` nullable

### `customers`
- `id` TEXT PK, format `cus_<random>`
- `merchant_id` FK, NOT NULL
- `email`, `phone` — needed for WhatsApp recovery in window phase
- `metadata` JSONB

### `plans`
- `id` TEXT PK, format `plan_<random>`
- `merchant_id` FK
- `amount` BIGINT (kobo — store everything in the smallest unit)
- `currency` TEXT (always `'NGN'` for now)
- `interval` TEXT, `interval_count` INTEGER

### `invoices`
- `id` TEXT PK, format `inv_<random>`
- `subscription_id` FK
- `status` enum (`open` | `paid` | `void` | `uncollectible`)
- `amount`, `amount_paid`
- `due_date`

### `payment_methods`
- `id` TEXT PK, format `pm_<random>`
- `customer_id` FK
- `nomba_token` — **only the token**, never card data
- `last4`, `brand`, `exp_month`, `exp_year` for display

### `charge_attempts`
- One row per attempt (success or fail)
- `invoice_id`, `attempted_at`, `status`, `reason` (when failed)
- The state machine's `lastFailureReason` is updated from the most recent failed attempt

---

## Multi-tenancy

Three layers, already specified in your Task 1:

1. **Drizzle middleware** — every query gets a `WHERE merchant_id = $1` injected from the request-scoped context
2. **RLS policies** on every tenant-scoped table — `merchant_id = current_setting('app.current_merchant_id')`
3. **Cross-tenant test suite** — your Task 4

The wrapper does NOT set `app.current_merchant_id` — the gateway does, at the start of each request. The wrapper trusts the row it loads. Your RLS catches the case where the wrapper is called for a subscription that doesn't belong to the requesting merchant.

---

## Pre-merge checklist for Daniel

Before opening the schema PR, verify each one. If any fails, the wrapper integration breaks.

- [ ] `subscriptions.state` exists and accepts all 11 enum values
- [ ] `subscriptions.version` exists, INTEGER NOT NULL DEFAULT 1
- [ ] Every field in `SubscriptionContext` has a corresponding column with the type listed in the table above
- [ ] `subscriptions.policy` is JSONB, validates against the DunningPolicy shape
- [ ] `audit_log` has all 7 fields with the exact column names listed
- [ ] `audit_log.actor` only accepts `'system'`, `'merchant'`, `'customer'`
- [ ] `processed_events` exists with unique `(subscription_id, idempotency_key)` constraint
- [ ] All tenant-scoped tables have `merchant_id NOT NULL` with FK to `merchants.id`
- [ ] RLS enabled on every tenant-scoped table
- [ ] Migrations apply cleanly against local Postgres AND Neon
- [ ] Tag Mayowa for review on the schema PR — he'll run the wrapper tests against the schema before approving

---

## Reference

- Wrapper: `services/engine/src/wrapper/subscription-wrapper.ts`
- Repository interface: `services/engine/src/wrapper/repository.ts`
- State machine: `services/engine/src/state-machines/subscription.ts`
- In-memory test impl (mirror this contract): `services/engine/tests/wrapper/in-memory-repository.ts`
- Internal HTTP contract: `docs/internal-api.md`
