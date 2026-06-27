# Engine Service

Node.js + TypeScript service. Owns the billing state machine, proration logic, multi-tenancy enforcement, and Nomba integration.

Owned by: Dev A (engine internals) + Dev B (Nomba rails)

Runs on port 3001 in local dev. Not publicly exposed — gateway calls it via internal HTTP.

See `docs/internal-api.md` for the HTTP contract this service exposes.

## Schema reference

All tenant-scoped tables carry a Postgres RLS policy (`merchant_id = current_setting('app.current_merchant_id')::text`) applied via the shared `merchantIsolationPolicy()` helper. The `merchants` table uses its own policy filtering on `id`. The `audit_log` table additionally enforces no-delete and no-update policies.

### `src/schema/merchants.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `mer` |
| `name` | `text` | Not null |
| `email` | `varchar` | Not null, unique |
| `company` | `varchar` | Not null |
| `created_at` | `timestamp with time zone` | Default `now()` |

### `src/schema/api_keys.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `ak` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `key_hash` | `text` | Not null, unique |
| `key_prefix` | `text` | Not null |
| `type` | `ApiKeyTypeEnum` | Enum: `live`, `test` |
| `revoked_at` | `timestamp` | Nullable |

### `src/schema/customers.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `cus` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `email` | `text` | Not null |
| `name` | `text` | Nullable |
| `phone` | `text` | Nullable |
| `metadata` | `jsonb` | Nullable |
| `created_at` | `timestamp with time zone` | Default `now()` |
| `updated_at` | `timestamp with time zone` | Default `now()` |

### `src/schema/plans.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `plan` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `name` | `text` | Not null |
| `description` | `text` | Nullable |
| `amount` | `bigint` | Not null (amount in kobo) |
| `currency` | `text` | Not null, default `NGN` |
| `interval` | `text` | Not null (e.g. `monthly`, `annual`) |
| `interval_count` | `integer` | Not null |
| `is_active` | `boolean` | Not null, default `true` |
| `metadata` | `jsonb` | Default `{}` |
| `created_at` | `timestamp with time zone` | Not null, default `now()` |
| `updated_at` | `timestamp with time zone` | Not null, default `now()` |

### `src/schema/subscriptions.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `sub` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `customer_id` | `text` | Not null, references `customers.id` |
| `plan_id` | `text` | Not null, references `plans.id` |
| `policy` | `jsonb` | Not null, default `DunningPolicy` |
| `state` | `SubscriptionStateEnum` | Not null, default `pending`. Enum: `pending`, `trialing`, `active`, `charging`, `retrying`, `va_fallback`, `ussd_fallback`, `whatsapp_fallback`, `paused`, `past_due`, `cancelled`, `refunded` |
| `version` | `integer` | Not null, default `1` (optimistic concurrency) |
| `retry_count` | `integer` | Not null, default `0` |
| `last_failure_reason` | `text` | Nullable |
| `last_failure_retryable` | `boolean` | Nullable |
| `va_id` | `text` | Nullable |
| `va_expires_at` | `timestamp with time zone` | Nullable |
| `current_invoice_id` | `text` | Nullable, references `invoices.id` |
| `cancel_at_period_end` | `boolean` | Not null, default `false` |
| `metadata` | `jsonb` | Default `{}` |
| `created_at` | `timestamp with time zone` | Not null, default `now()` |
| `updated_at` | `timestamp with time zone` | Not null, default `now()` |
| `next_billing_at` | `timestamp with time zone` | Nullable |
| `trial_ends_at` | `timestamp with time zone` | Nullable |
| `current_period_start` | `timestamp with time zone` | Not null |
| `current_period_end` | `timestamp with time zone` | Not null |
| `paused_at` | `timestamp with time zone` | Nullable |
| `cancelled_at` | `timestamp with time zone` | Nullable |

### `src/schema/invoices.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `inv` |
| `subscription_id` | `text` | Not null, references `subscriptions.id` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `status` | `InvoiceStatusEnum` | Not null, default `open`. Enum: `open`, `paid`, `void`, `uncollectible`, `pending_retry`, `recovered` |
| `amount` | `numeric(10,2)` | Not null (amount in kobo) |
| `amount_paid` | `numeric(10,2)` | Not null, default `0` |
| `currency` | `text` | Not null, default `NGN` |
| `description` | `text` | Nullable |
| `metadata` | `jsonb` | Default `{}` |
| `due_date` | `timestamp with time zone` | Not null |
| `paid_at` | `timestamp with time zone` | Nullable |
| `next_attempt_at` | `timestamp with time zone` | Nullable |
| `created_at` | `timestamp with time zone` | Default `now()` |

### `src/schema/payment_methods.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `pm` |
| `customer_id` | `text` | Not null, references `customers.id` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `type` | `PaymentMethodTypeEnum` | Not null. Enum: `card`, `virtual_account`, `ussd` |
| `nomba_token` | `text` | Not null |
| `last4` | `text` | Not null (last 4 digits of card/VAN) |
| `brand` | `text` | Not null (card issuer / bank) |
| `exp_month` | `text` | Not null |
| `exp_year` | `text` | Not null |
| `is_default` | `boolean` | Not null, default `false` |
| `metadata` | `jsonb` | Default `{}` |
| `created_at` | `timestamp with time zone` | Default `now()` |
| `deleted_at` | `timestamp with time zone` | Nullable (soft delete) |

### `src/schema/charge_attempts.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key, prefix `ch` |
| `invoice_id` | `text` | Not null, references `invoices.id` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `attempted_at` | `timestamp with time zone` | Default `now()` |
| `status` | `ChargeStatus` | Not null. Enum: `failed`, `success` |
| `reason` | `text` | Nullable |

### `src/schema/audit_log.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `subscription_id` | `text` | Not null, references `subscriptions.id` |
| `from_state` | `SubscriptionStateEnum` | Not null |
| `to_state` | `SubscriptionStateEnum` | Not null |
| `actor` | `ActorEnum` | Nullable. Enum: `merchant`, `system`, `customer` |
| `reason` | `text` | Nullable |
| `timestamp` | `timestamp with time zone` | Default `now()` |

Additionally: `audit_log` has restrictive policies blocking all `DELETE` and `UPDATE` — the table is append-only.

### `src/schema/processed_events.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `gen_random_uuid()` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `subscription_id` | `text` | Not null, references `subscriptions.id` |
| `idempotency_key` | `text` | Not null. Unique constraint per (subscription, key) |
| `cached_state` | `SubscriptionStateEnum` | Not null |
| `cached_context` | `jsonb` | Not null |
| `created_at` | `timestamp with time zone` | Default `now()` |

## State machine

### `src/state-machines/subscription.ts`
| Element | Type | Notes |
| --- | --- | --- |
| `SubscriptionContext` | interface | Subscription metadata and runtime state |
| `DunningPolicy` | interface | Retry and fallback policy configuration |
| `SubscriptionEvent` | union type | Lifecycle, charge, retry, fallback, and intent events |
| `subscriptionMachine` | `xstate` machine | States: `pending`, `trialing`, `charging`, `retrying`, `va_fallback`, `ussd_fallback`, `whatsapp_fallback`, `active`, `paused`, `past_due`, `cancelled`, `refunded` |

## Multi-tenancy

Three layers of defense:
1. **Per-request scoped repository.** `DrizzleSubscriptionRepository` calls `set_config('app.current_merchant_id', $merchant, true)` inside every transaction, scoping all queries to a single merchant.
2. **Postgres RLS.** Every tenant-scoped table has a `merchantIsolationPolicy()` that enforces `merchant_id = current_setting('app.current_merchant_id')::text`.
3. **Internal API middleware.** Every `/internal/v1/*` route passes through `requireInternalAuth` and `extractMerchantId`, ensuring only the Gateway (with the shared secret) can call internal endpoints, and every call is merchant-scoped.

## Migrations

Generated via `npx drizzle-kit generate` and applied via `npx drizzle-kit migrate`.

| Migration | What it does |
| --- | --- |
| `0000_brave_plazm` | Initial schema — all core tables + RLS |
| `0003_even_dagger` | Add indexes on subscriptions |
| `0004_striped_skaar` | Add `customer_id` FK, `policy` defaults, `next_billing_at` |
| `0005_conscious_scarlet_witch` | Add `processed_events` table + unique constraint |
| `0006_rich_magneto` | Add `trial_ends_at`, `current_period_start/end`, billing timestamps |
| `0007_condemned_ben_urich` | Add `name`/`description`/`metadata`/`is_active` on plans, `name`/`updated_at` on customers, `currency`/`description`/`metadata` on invoices, `type`/`metadata` on payment_methods, `refunded` state, `cancel_at_period_end` on subscriptions |
