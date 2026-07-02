export const routes = [
  { method: "POST", path: "/internal/v1/plans", resource: "plans" },
  { method: "GET", path: "/internal/v1/plans", resource: "plans" },
  { method: "GET", path: "/internal/v1/plans/:id", resource: "plans" },
  { method: "PATCH", path: "/internal/v1/plans/:id", resource: "plans" },
  { method: "DELETE", path: "/internal/v1/plans/:id", resource: "plans" },

  { method: "POST", path: "/internal/v1/customers", resource: "customers" },
  { method: "GET", path: "/internal/v1/customers", resource: "customers" },
  { method: "GET", path: "/internal/v1/customers/:id", resource: "customers" },

  {
    method: "POST",
    path: "/internal/v1/subscriptions",
    resource: "subscriptions",
  },
  {
    method: "GET",
    path: "/internal/v1/subscriptions",
    resource: "subscriptions",
  },
  {
    method: "GET",
    path: "/internal/v1/subscriptions/:id",
    resource: "subscriptions",
  },
  {
    method: "PATCH",
    path: "/internal/v1/subscriptions/:id",
    resource: "subscriptions",
  },
  {
    method: "POST",
    path: "/internal/v1/subscriptions/:id/cancel",
    resource: "subscriptions",
  },
  {
    method: "POST",
    path: "/internal/v1/subscriptions/:id/pause",
    resource: "subscriptions",
  },
  {
    method: "POST",
    path: "/internal/v1/subscriptions/:id/resume",
    resource: "subscriptions",
  },
  {
    method: "POST",
    path: "/internal/v1/subscriptions/:id/preview",
    resource: "subscriptions",
  },

  { method: "GET", path: "/internal/v1/invoices", resource: "invoices" },
  { method: "GET", path: "/internal/v1/invoices/:id", resource: "invoices" },
  { method: "POST", path: "/internal/v1/invoices", resource: "invoices" },
  {
    method: "POST",
    path: "/internal/v1/invoices/:id/retry",
    resource: "invoices",
  },
  {
    method: "POST",
    path: "/internal/v1/invoices/:id/refund",
    resource: "invoices",
  },
  {
    method: "POST",
    path: "/internal/v1/invoices/:id/fallback",
    resource: "invoices",
  },

  {
    method: "POST",
    path: "/internal/v1/payment-methods",
    resource: "payment-methods",
  },
  {
    method: "GET",
    path: "/internal/v1/payment-methods",
    resource: "payment-methods",
  },
  {
    method: "GET",
    path: "/internal/v1/payment-methods/:id",
    resource: "payment-methods",
  },
  {
    method: "DELETE",
    path: "/internal/v1/payment-methods/:id",
    resource: "payment-methods",
  },

  {
    method: "POST",
    path: "/internal/v1/webhooks/management/endpoints",
    resource: "webhook-endpoints",
  },
  {
    method: "GET",
    path: "/internal/v1/webhooks/management/endpoints",
    resource: "webhook-endpoints",
  },
  {
    method: "GET",
    path: "/internal/v1/webhooks/management/endpoints/:id",
    resource: "webhook-endpoints",
  },
  {
    method: "PATCH",
    path: "/internal/v1/webhooks/management/endpoints/:id",
    resource: "webhook-endpoints",
  },
  {
    method: "DELETE",
    path: "/internal/v1/webhooks/management/endpoints/:id",
    resource: "webhook-endpoints",
  },
  {
    method: "POST",
    path: "/internal/v1/webhooks/management/deliveries/:id/replay",
    resource: "webhook-deliveries",
  },
  {
    method: "GET",
    path: "/internal/v1/webhooks/management/deliveries",
    resource: "webhook-deliveries",
  },
  {
    method: "GET",
    path: "/internal/v1/webhooks/management/events",
    resource: "webhook-events",
  },
];
