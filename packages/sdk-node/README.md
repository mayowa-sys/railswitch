# railswitch

Official TypeScript SDK for [RailSwitch](https://railswitch-gateway.fly.dev) — recurring billing recovery for Nigeria.

## Install

```bash
npm install railswitch
```

## Quickstart

```typescript
import { RailSwitch } from "railswitch";

const rs = new RailSwitch({ apiKey: "sk_test_..." });

// Create a plan
const plan = await rs.plans.create({
  name: "Pro Monthly",
  description: "Professional tier, billed monthly",
  amount: 15000,
  interval: "monthly",
  interval_count: 1,
});

// Create a customer
const customer = await rs.customers.create({
  name: "John Doe",
  email: "john@example.com",
});

// Subscribe a customer
const subscription = await rs.subscriptions.create({
  customer_id: customer.id,
  plan_id: plan.id,
  start_date: new Date().toISOString(),
});

// Preview a plan change
const preview = await rs.subscriptions.preview(subscription.id, "plan_pro_annual");
console.log(`Net charge: ₦${preview.net_amount}`);

// Pause / Resume / Cancel
await rs.subscriptions.pause(subscription.id);
await rs.subscriptions.resume(subscription.id);
await rs.subscriptions.cancel(subscription.id, "No longer needed");

// Payment methods
await rs.paymentMethods.create({
  customer_id: customer.id,
  type: "card",
  nomba_token: "tok_abc123",
  last4: "4242",
  brand: "visa",
});

// Webhooks
const endpoint = await rs.webhooks.createEndpoint("https://example.com/webhook");
await rs.webhooks.deleteEndpoint(endpoint.id);
```

## API Reference

| Resource | Methods |
|----------|---------|
| `plans` | `create`, `list`, `get`, `update`, `delete` |
| `customers` | `create`, `list`, `get` |
| `subscriptions` | `create`, `list`, `get`, `update`, `pause`, `resume`, `cancel`, `preview` |
| `invoices` | `list`, `get`, `retry` |
| `paymentMethods` | `create`, `list`, `get`, `delete` |
| `webhooks` | `createEndpoint`, `listEndpoints`, `getEndpoint`, `updateEndpoint`, `deleteEndpoint`, `listEvents`, `listDeliveries` |

## License

MIT
