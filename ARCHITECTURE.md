# RailSwitch — Architecture & Security Note

## Overview

RailSwitch is a managed recurring-billing engine built on top of Nomba's payment primitives. It provides plan management, billing cycles, proration, dunning/failed-payment recovery, customer self-service, and webhooks — capabilities that product teams would otherwise rebuild from scratch.

---

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Storefront  │────▶│   Gateway    │────▶│   Engine     │
│  (Next.js)   │     │  (FastAPI)   │     │  (Express)   │
│  :3200       │     │  :8000       │     │  :3001       │
└─────────────┘     └──────┬───────┘     └──────┬───────┘
                           │                    │
┌─────────────┐            │                    │
│  Dashboard   │───────────┘                    │
│  (Next.js)   │                               │
│  :3000       │                    ┌──────────▼──────────┐
└─────────────┘                    │     PostgreSQL       │
                                   │  (RLS per merchant)  │
┌─────────────┐                    └─────────────────────┘
│   Portal     │
│  (Next.js)   │                    ┌─────────────────────┐
│  :3100       │                    │   Nomba Sandbox     │
└─────────────┘                    │  - Checkout API      │
                                   │  - Tokenised Cards   │
                                   │  - Virtual Accounts  │
                                   │  - Transfers         │
                                   └─────────────────────┘
```

### Services

| Service | Stack | Port | Purpose |
|---------|-------|------|---------|
| Engine | Express/TypeScript | 3001 | Core billing logic, state machine, dunning, proration |
| Gateway | FastAPI/Python | 8000 | API gateway, auth, rate limiting, request routing |
| Dashboard | Next.js | 3000 | Merchant admin panel |
| Portal | Next.js | 3100 | Customer self-service portal |
| Storefront | Next.js | 3200 | Subscription signup/checkout |
| PostgreSQL | PostgreSQL 15 | 5432 | Primary data store |

---

## Authentication

### External API (Gateway → Merchant)

- **Mechanism**: Bearer token (API key) in `Authorization` header
- **Key format**: `sk_{live|test}_{merchant_id}__{random_chars}`
- **Validation**: Regex format check + merchant_id extraction
- **Storage**: Keys stored as SHA-256 hashes in database

### Internal API (Gateway → Engine)

- **Mechanism**: Shared secret in `X-Internal-Auth` header
- **Secret**: `INTERNAL_AUTH_SECRET` env var (identical on both services)
- **Merchant scope**: `X-Merchant-Id` header passed alongside

### Portal Authentication

- **Mechanism**: HMAC-signed token passed as query parameter
- **Signing**: HMAC-SHA256 with `PORTAL_SECRET`
- **Payload**: `{ customerId, merchantId, exp }` (7-day expiry)
- **Verification**: Constant-time comparison via `crypto.timingSafeEqual`

### Nomba Webhook Authentication

- **Mechanism**: HMAC-SHA256 signature in headers
- **Verification**: `crypto.timingSafeEqual` (engine) / `hmac.compare_digest` (gateway)
- **Idempotency**: Processed events tracked in `processed_events` table

---

## Multi-Tenant Data Isolation

### Row-Level Security (RLS)

Every table with merchant data has an RLS policy:

```sql
CREATE POLICY merchant_isolation ON table_name
  USING (merchant_id = current_setting('app.current_merchant_id')::text)
  WITH CHECK (merchant_id = current_setting('app.current_merchant_id')::text);
```

### RLS Context Setting

- **Middleware** (`rls.ts`): Sets session-level config via `set_config('app.current_merchant_id', $1, false)`
- **Transactions**: Sets transaction-local config via `set_config(..., true)` before queries
- **All queries parameterized**: No string interpolation in SQL

### Application-Level Checks

Beyond RLS, every query includes explicit `WHERE merchant_id = $1` filters as a defense-in-depth measure.

### Cross-Tenant Tests

5 integration tests verify that Merchant B cannot access Merchant A's resources across plans, customers, subscriptions, invoices, and payment methods.

---

## Webhook System

### Outbound (RailSwitch → Merchant)

**19 event types**:

| Category | Events |
|----------|--------|
| Subscription | `created`, `active`, `cancelled`, `paused`, `resumed`, `trial_ending`, `plan_changed` |
| Payment | `succeeded`, `failed`, `recovered` |
| Invoice | `created`, `paid`, `uncollectible` |
| Cascade | `retrying`, `va_fallback`, `whatsapp_fallback`, `past_due`, `recovered` |

**Delivery**:
- HTTP POST to registered endpoints
- Headers: `X-RailSwitch-Signature` (HMAC-SHA256), `X-RailSwitch-Timestamp`, `X-RailSwitch-Event`
- Retry with exponential backoff (up to 9 attempts, max 24h)

### Inbound (Nomba → RailSwitch)

| Event | Action |
|-------|--------|
| `payment_success` | Mark invoice paid, recover subscription |
| `virtual_account.funded` | Mark invoice paid via VA transfer |
| `transfer.success` | Log refund completion |
| `transfer.failed` | Log refund failure |

---

## Dunning & Payment Recovery

### State Machine

```
active → retrying → va_fallback → whatsapp_fallback → past_due → cancelled
  ↑           │            │              │
  └───────────┴────────────┴──────────────┘ (recovered at any stage)
```

### Cascade Flow

1. **Card Retry** (up to 3 attempts, exponential backoff)
2. **Virtual Account** (Nomba VA created, bank transfer instructions sent)
3. **WhatsApp Recovery** (Meta Cloud API with VA details)
4. **Past Due** (final state before cancellation)

### Recovery Rate Formula

```
recovery_rate = paid_invoices / (paid_invoices + uncollectible_invoices)
```

---

## Proration

### Credits-Based Model

- **Downgrade**: Difference stored as `downgrade` credit
- **Pause**: Unused time banked as `pause_credit`
- **Resume**: Period extended by pause duration
- **Upgrade**: Existing credits applied first, net amount charged immediately

---

## Nomba API Integration

| Nomba API | RailSwitch Usage |
|-----------|-----------------|
| `POST /v1/checkout/tokenized-card-payment` | Recurring card charges |
| `DELETE /v1/tokenized-card/{tokenId}` | Revoke compromised cards |
| `POST /v1/accounts/virtual` | Create VA for dunning fallback |
| `POST /v1/transfers/bank` | Process refunds |
| `POST /v1/transfers/bank/lookup` | Verify bank accounts |
| `POST /v1/auth/token/issue` | OAuth2 token management |

---

## Security Measures

1. **Parameterized queries** throughout (Drizzle ORM + sql tagged templates)
2. **RLS** on all merchant-scoped tables
3. **HMAC-SHA256** for webhook and portal token verification
4. **Constant-time comparison** (`crypto.timingSafeEqual`) to prevent timing attacks
5. **Idempotency** on webhook processing (dedup via `processed_events` table)
6. **CORS** restricted to localhost origins (dashboard, portal, storefront)
7. **No secrets in code** — all sensitive values via environment variables
8. **Cross-tenant isolation tests** — 5 integration tests verify merchant boundaries

---

## Test Credentials

### Demo Merchant
```
Merchant ID: mer_k_W0XspbNN
API Key:     sk_test_mer_k_W0XspbNN__y70_WaK_hR1iJU7qn95WUclycPU
Email:       demo@railswitch.dev
Password:    demo123456
```

### Nomba Sandbox (pre-configured)
```
Client ID:     706df6c4-b8bb-4130-88c4-d21b052f8631
Account ID:    f666ef9b-888e-4799-85ce-acb505b28023
```

### Test Card (Nomba Sandbox)
```
Use storefront checkout flow — Nomba sandbox accepts test card tokens
```
