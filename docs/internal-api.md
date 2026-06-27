# RailSwitch Internal API Contract v0

The **Gateway** (FastAPI) calls the **Engine** (Express/Fastify) over a private HTTP interface.  
All endpoints are internal only – never exposed to the public internet.  
The Engine listens on `http://engine:3001` (Docker network) or `http://localhost:3001` locally.

---

## Authentication & Headers

Every request must include:

| Header            | Value                                          | Required |
|-------------------|------------------------------------------------|----------|
| `X-Internal-Auth` | A pre-shared secret (`ENGINE_INTERNAL_SECRET`) | Yes      |
| `X-Merchant-Id`   | UUID of the merchant (for multi‑tenancy)       | Yes      |
| `X-Request-Id`    | UUID for idempotency and tracing               | Yes      |
| `Content-Type`    | `application/json`                             | Yes      |

**Mutation endpoints** (POST, PATCH) additionally require:

| Header               | Purpose                                 |
|----------------------|-----------------------------------------|
| `Idempotency-Key`    | Client‑generated UUID to safely retry   |

If the key is reused, the Engine returns the original response (200/201) and does not re‑execute the operation.

---

## Error Response Format

All errors use the same shape:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Human‑readable description",
    "details": {}   // optional payload
  }
}
```

Common error codes:
- `INVALID_REQUEST` – validation failure
- `RESOURCE_NOT_FOUND` – entity not found
- `TENANT_MISMATCH` – attempted cross‑tenant access
- `STATE_TRANSITION_INVALID` – forbidden state change
- `IDEMPOTENCY_KEY_REUSED` – different payload with same key
- `INTERNAL_ERROR`

HTTP status codes follow REST conventions: 200, 201, 400, 404, 409, 422, 500.

---

## Resources

### 1. Plans

#### `POST /internal/v1/plans`
Create a new subscription plan.

**Request:**
```json
{
  "name": "Pro",
  "description": "Pro monthly plan",
  "amount": 15000,
  "currency": "NGN",
  "interval": "monthly",          // "monthly" | "annual" | "custom"
  "interval_count": 1,            // number of intervals
  "metadata": {
    "tier": "pro"
  }
}
```

**Response 201:**
```json
{
  "id": "plan_abc123",
  "merchant_id": "mer_xyz",
  "name": "Pro",
  "description": "Pro monthly plan",
  "amount": 15000,
  "currency": "NGN",
  "interval": "monthly",
  "interval_count": 1,
  "is_active": true,
  "metadata": { "tier": "pro" },
  "created_at": "2026-06-21T10:00:00Z",
  "updated_at": "2026-06-21T10:00:00Z"
}
```

#### `GET /internal/v1/plans`
List all plans for the merchant.

**Response 200:**
```json
{
  "data": [ /* array of plan objects */ ],
  "total": 2
}
```

#### `GET /internal/v1/plans/{plan_id}`
Retrieve a single plan.

---

### 2. Customers

#### `POST /internal/v1/customers`
Create a customer.

**Request:**
```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "phone": "+2348012345678",
  "metadata": {}
}
```

**Response 201:**
```json
{
  "id": "cus_xyz",
  "merchant_id": "mer_xyz",
  "email": "user@example.com",
  "name": "Jane Doe",
  "phone": "+2348012345678",
  "metadata": {},
  "created_at": "2026-06-21T10:05:00Z",
  "updated_at": "2026-06-21T10:05:00Z"
}
```

#### `GET /internal/v1/customers`
List customers with optional filtering:
- Query params: `?email=...`, `?limit=20`, `?offset=0`

**Response 200:**
```json
{
  "data": [ /* customer objects */ ],
  "total": 15
}
```

#### `GET /internal/v1/customers/{customer_id}`
Retrieve a single customer.

---

### 3. Payment Methods

#### `POST /internal/v1/payment_methods`
Attach a payment method to a customer. Currently supports tokenized cards (token from Nomba) and virtual account references.

**Request:**
```json
{
  "customer_id": "cus_xyz",
  "type": "card",                 // "card" | "virtual_account" | "ussd"
  "token": "nomba_token_key_...", // required for card
  "metadata": {}
}
```

**Response 201:**
```json
{
  "id": "pm_456",
  "customer_id": "cus_xyz",
  "type": "card",
  "last4": "4242",
  "brand": "visa",
  "exp_month": 12,
  "exp_year": 2028,
  "is_default": false,
  "metadata": {},
  "created_at": "2026-06-21T10:10:00Z"
}
```

#### `GET /internal/v1/payment_methods?customer_id=cus_xyz`
List payment methods for a customer.

#### `GET /internal/v1/payment_methods/{pm_id}`
Retrieve a single payment method.

---

### 4. Subscriptions

#### `POST /internal/v1/subscriptions`
Create a subscription for a customer on a plan.

**Request:**
```json
{
  "customer_id": "cus_xyz",
  "plan_id": "plan_abc123",
  "start_date": "2026-06-21T10:00:00Z",   // optional, defaults to now
  "trial_end": null,                      // optional ISO date
  "metadata": {}
}
```

**Response 201:**
```json
{
  "id": "sub_789",
  "merchant_id": "mer_xyz",
  "customer_id": "cus_xyz",
  "plan_id": "plan_abc123",
  "status": "in_trial",                  // or "active"
  "current_period_start": "2026-06-21T10:00:00Z",
  "current_period_end": "2026-07-21T10:00:00Z",
  "trial_end": null,
  "cancel_at_period_end": false,
  "metadata": {},
  "created_at": "2026-06-21T10:15:00Z",
  "updated_at": "2026-06-21T10:15:00Z"
}
```

#### `GET /internal/v1/subscriptions`
List subscriptions (with query filters: `?customer_id=...`, `?status=active`, `?limit=10`).

#### `GET /internal/v1/subscriptions/{subscription_id}`
Retrieve a single subscription.

#### `PATCH /internal/v1/subscriptions/{subscription_id}`
Update subscription state (e.g., cancel at period end, change plan, dunning actions).

Allowed partial update body:
```json
{
  "cancel_at_period_end": true,
  "metadata": { "reason": "customer request" }
}
```
or for plan change:
```json
{
  "plan_id": "plan_pro",
  "effective_date": "2026-06-25T00:00:00Z"
}
```

State transitions (like `in_dunning` → `suspended`) are handled by the Engine automatically based on billing cycle outcomes – not set directly.

**Response 200:** Updated subscription object.

#### `POST /internal/v1/subscriptions/{subscription_id}/preview`
Preview the proration calculation for a plan change **without** applying it.

**Request:**
```json
{
  "new_plan_id": "plan_pro",
  "effective_date": "2026-06-25T00:00:00Z"
}
```

**Response 200:**
```json
{
  "current_plan": {
    "id": "plan_starter",
    "name": "Starter",
    "amount": 5000,
    "currency": "NGN",
    "interval": "monthly"
  },
  "new_plan": {
    "id": "plan_pro",
    "name": "Pro",
    "amount": 15000,
    "currency": "NGN",
    "interval": "monthly"
  },
  "current_period_start": "2026-06-01T00:00:00Z",
  "current_period_end": "2026-06-30T23:59:59Z",
  "effective_date": "2026-06-25T00:00:00Z",
  "remaining_days": 5,
  "total_days_in_period": 30,
  "credit": {
    "amount": 833.33,
    "description": "Unused portion of Starter"
  },
  "charge": {
    "amount": 2500.00,
    "description": "Prorated charge for Pro for 5 days"
  },
  "net_amount": 1666.67,
  "currency": "NGN"
}
```

---

### 5. Invoices

#### `POST /internal/v1/invoices`
Generate an invoice (e.g., at renewal or proration). Usually created automatically by the billing cycle; also available for manual use.

**Request:**
```json
{
  "subscription_id": "sub_789",
  "amount": 15000,
  "currency": "NGN",
  "description": "Monthly renewal - Pro plan",
  "due_date": "2026-07-21T10:00:00Z",
  "metadata": {}
}
```

**Response 201:**
```json
{
  "id": "inv_101",
  "subscription_id": "sub_789",
  "merchant_id": "mer_xyz",
  "amount": 15000,
  "currency": "NGN",
  "status": "pending",
  "description": "Monthly renewal - Pro plan",
  "due_date": "2026-07-21T10:00:00Z",
  "metadata": {},
  "created_at": "2026-06-21T10:20:00Z"
}
```

#### `GET /internal/v1/invoices`
List invoices (filters: `?subscription_id=...`, `?status=open`, `?customer_id=...`).

#### `GET /internal/v1/invoices/{invoice_id}`
Retrieve an invoice, including any associated charge attempts.

**Response 200:**
```json
{
  "id": "inv_101",
  "subscription_id": "sub_789",
  "amount": 15000,
  "currency": "NGN",
  "status": "pending",
  "charge_attempts": [
    {
      "id": "ch_att_1",
      "payment_method_id": "pm_456",
      "gateway": "nomba_card",
      "amount": 15000,
      "status": "failed",
      "error_code": "insufficient_funds",
      "created_at": "2026-07-21T10:01:00Z"
    }
  ],
  ...
}
```

---

### 6. Dunning & Cascade Hooks (Internal)

Not directly called by Gateway; the Engine’s scheduler or webhooks drive the cascade. However, Gateway may need to trigger a **manual retry** or re‑generate fallback methods for an invoice.

#### `POST /internal/v1/invoices/{invoice_id}/retry`
Force a retry of the next available payment method for the invoice (used for manual admin action).

**Response 202:**
```json
{
  "invoice_id": "inv_101",
  "status": "retry_initiated",
  "next_attempt_at": "2026-07-21T12:00:00Z"
}
```

#### `POST /internal/v1/invoices/{invoice_id}/fallback`
Manually trigger generation of fallback payment options (VA, USSD, WhatsApp link) for an invoice, even if the cascade schedule hasn’t reached that stage yet.

**Response 201:**
```json
{
  "invoice_id": "inv_101",
  "fallback_methods": [
    {
      "type": "virtual_account",
      "account_number": "1234567890",
      "bank_name": "Nomba",
      "expires_at": "2026-07-24T10:20:00Z"
    },
    {
      "type": "ussd",
      "code": "*737*123456#",
      "expires_at": "2026-07-28T10:20:00Z"
    }
  ]
}
```

---

## Versioning

The API is versioned via the URL path (`/internal/v1/...`). Breaking changes will bump the version to v2. The contract will be updated here as the pre‑window evolves.