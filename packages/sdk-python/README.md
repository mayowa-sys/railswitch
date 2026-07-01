# railswitch

Official Python SDK for [RailSwitch](https://railswitch-gateway.fly.dev) — recurring billing recovery for Nigeria.

## Install

```bash
pip install railswitch
```

## Quickstart

```python
from railswitch import RailSwitch

rs = RailSwitch(api_key="sk_test_...")

# Create a plan
plan = rs.plans.create(
    name="Pro Monthly",
    description="Professional tier, billed monthly",
    amount=15000,
    interval="monthly",
    interval_count=1,
)

# Create a customer
customer = rs.customers.create(
    name="John Doe",
    email="john@example.com",
)

# Subscribe a customer
subscription = rs.subscriptions.create(
    customer_id=customer.id,
    plan_id=plan.id,
    start_date="2026-07-01T00:00:00Z",
)

# Preview a plan change
preview = rs.subscriptions.preview(subscription.id, "plan_pro_annual")
print(f"Net charge: ₦{preview['net_amount']}")

# Pause / Resume / Cancel
rs.subscriptions.pause(subscription.id)
rs.subscriptions.resume(subscription.id)
rs.subscriptions.cancel(subscription.id, reason="No longer needed")

# Payment methods
rs.payment_methods.create(
    customer_id=customer.id,
    type="card",
    nomba_token="tok_abc123",
    last4="4242",
    brand="visa",
)

# Webhooks
endpoint = rs.webhooks.create_endpoint("https://example.com/webhook")
rs.webhooks.delete_endpoint(endpoint.id)

# Use as context manager (auto-closes HTTP client)
with RailSwitch(api_key="sk_test_...") as rs:
    plans = rs.plans.list()
```

## API Reference

| Resource | Methods |
|----------|---------|
| `plans` | `create`, `list`, `get`, `update`, `delete` |
| `customers` | `create`, `list`, `get` |
| `subscriptions` | `create`, `list`, `get`, `update`, `pause`, `resume`, `cancel`, `preview` |
| `invoices` | `list`, `get`, `retry` |
| `payment_methods` | `create`, `list`, `get`, `delete` |
| `webhooks` | `create_endpoint`, `list_endpoints`, `get_endpoint`, `update_endpoint`, `delete_endpoint`, `list_events`, `list_deliveries` |

## License

MIT
