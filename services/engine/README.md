# Engine Service

Node.js + TypeScript service. Owns the billing state machine, proration logic, multi-tenancy enforcement, and Nomba integration.

Owned by: Dev A (engine internals) + Dev B (Nomba rails)

Runs on port 3001 in local dev. Not publicly exposed — gateway calls it via internal HTTP.

See `docs/internal-api.md` for the HTTP contract this service exposes.

## Schema reference

### `src/schema/api_keys.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `key_hash` | `text` | Not null, unique |
| `key_prefix` | `text` | Not null |
| `type` | `ApiKeyTypeEnum` | Enum: `live`, `test` |
| `revoked_at` | `timestamp` | Nullable |

### `src/schema/audit_log.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `uuid_generate_v4()` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `subscription_id` | `text` | Not null, references `subscriptions.id` |
| `from_state` | `SubscriptionStateEnum` | Not null |
| `to_state` | `SubscriptionStateEnum` | Not null |
| `actor` | `ActorEnum` | Nullable |
| `reason` | `text` | Nullable |
| `timestamp` | `timestamp with time zone` | Default `now()` |

### `src/schema/charge_attempts.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `invoice_id` | `text` | Not null, references `invoices.id` |
| `attempted_at` | `timestamp with time zone` | Default `now()` |
| `status` | `ChargeStatus` | Enum: `failed`, `success` |
| `reason` | `text` | Nullable |

### `src/schema/customers.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `email` | `text` | Not null |
| `phone` | `text` | Nullable |
| `metadata` | `jsonb` | Nullable |
| `created_at` | `timestamp with time zone` | Default `now()` |

### `src/schema/invoices.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `subscription_id` | `text` | Not null, references `subscriptions.id` |
| `status` | `InvoiceStatusEnum` | Not null, default `open` |
| `amount` | `numeric(10,2)` | Not null |
| `amount_paid` | `numeric(10,2)` | Not null, default `0` |
| `due_date` | `timestamp with time zone` | Not null |
| `created_at` | `timestamp with time zone` | Default `now()` |

### `src/schema/merchants.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `name` | `text` | Not null |
| `email` | `varchar` | Not null, unique |
| `company` | `varchar` | Not null |
| `created_at` | `timestamp with time zone` | Default `now()` |

### `src/schema/payment_methods.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `customer_id` | `text` | Not null, references `customers.id` |
| `nomba_token` | `text` | Not null |
| `last4` | `text` | Not null |
| `brand` | `text` | Not null |
| `exp_month` | `text` | Not null |
| `exp_year` | `text` | Not null |

### `src/schema/plans.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` | Primary key |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `amount` | `bigint` | Not null |
| `currency` | `text` | Not null, default `NGN` |
| `interval` | `text` | Not null |
| `interval_count` | `integer` | Not null |

### `src/schema/processed_events.schema.ts`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, default `uuid_generate_v4()` |
| `merchant_id` | `text` | Not null, references `merchants.id` |
| `subscription_id` | `text` | Not null, references `subscriptions.id` |
| `idempotency_key` | `text` | Not null |
| `cached_state` | `SubscriptionStateEnum` | Not null |
| `cached_context` | `jsonb` | Not null |
| `created_at` | `timestamp with time zone` | Default `now()` |

### `src/state-machines/subscription.ts`
| Element | Type | Notes |
| --- | --- | --- |
| `SubscriptionContext` | interface | Subscription metadata and runtime state |
| `DunningPolicy` | interface | Retry and fallback policy configuration |
| `SubscriptionEvent` | union type | Lifecycle, charge, retry, fallback, and intent events |
| `subscriptionMachine` | `xstate` machine | States: `pending`, `trialing`, `charging`, `retrying`, `va_fallback`, `ussd_fallback`, `whatsapp_fallback`, `active`, `paused`, `past_due`, `cancelled` |

