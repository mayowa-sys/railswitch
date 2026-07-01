export interface RailSwitchConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  is_active: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  name: string;
  description: string;
  amount: number;
  interval: string;
  currency?: string;
  interval_count?: number;
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerInput {
  email: string;
  name: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  state: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionInput {
  customer_id: string;
  plan_id: string;
  start_date?: string;
  trial_end?: string;
  metadata?: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  subscription_id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  due_date: string;
  created_at: string;
}

export interface ProrationPreview {
  immediate_charge: number;
  credit_applied: number;
  unused_credit: number;
  net_amount: number;
  next_invoice_amount: number;
  invoice_date: string;
  items: { plan_name: string; plan_amount: number; plan_interval: string }[];
  currency: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  status: string;
  last_delivery_at?: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  customer_id: string;
  type: string;
  nomba_token: string;
  last4?: string;
  brand?: string;
  is_default: boolean;
  created_at: string;
}

export interface CreatePaymentMethodInput {
  customer_id: string;
  type: string;
  nomba_token: string;
  last4?: string;
  brand?: string;
  exp_month?: string;
  exp_year?: string;
  is_default?: boolean;
}

export interface Envelope<T> {
  data: T;
  error: { code: string; message: string } | null;
  meta: Record<string, unknown> | null;
}

export class RailSwitchError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RailSwitchError";
  }
}

async function request<T>(baseUrl: string, apiKey: string, path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: {
      ...opts.headers,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let msg = body;
    try { msg = JSON.parse(body).error?.message ?? body; } catch { /* use raw */ }
    throw new RailSwitchError(res.status, msg);
  }

  const json = await res.json();
  return (json.data ?? json) as T;
}

export class RailSwitch {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: RailSwitchConfig) {
    this.baseUrl = config.baseUrl ?? "https://railswitch-gateway.fly.dev";
    this.apiKey = config.apiKey;
  }

  readonly plans = {
    create: (input: CreatePlanInput) =>
      request<Plan>(this.baseUrl, this.apiKey, "/v1/plans", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    list: () =>
      request<Plan[]>(this.baseUrl, this.apiKey, "/v1/plans"),
    get: (id: string) =>
      request<Plan>(this.baseUrl, this.apiKey, `/v1/plans/${id}`),
    update: (id: string, input: Partial<CreatePlanInput>) =>
      request<Plan>(this.baseUrl, this.apiKey, `/v1/plans/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      request<{ id: string; deleted: boolean }>(this.baseUrl, this.apiKey, `/v1/plans/${id}`, {
        method: "DELETE",
      }),
  };

  readonly customers = {
    create: (input: CreateCustomerInput) =>
      request<Customer>(this.baseUrl, this.apiKey, "/v1/customers", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    list: () =>
      request<Customer[]>(this.baseUrl, this.apiKey, "/v1/customers"),
    get: (id: string) =>
      request<Customer>(this.baseUrl, this.apiKey, `/v1/customers/${id}`),
  };

  readonly subscriptions = {
    create: (input: CreateSubscriptionInput) =>
      request<Subscription>(this.baseUrl, this.apiKey, "/v1/subscriptions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    list: () =>
      request<Subscription[]>(this.baseUrl, this.apiKey, "/v1/subscriptions"),
    get: (id: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}`),
    update: (id: string, input: { plan_id?: string; cancel_at_period_end?: boolean }) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    pause: (id: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/pause`, { method: "POST" }),
    resume: (id: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/resume`, { method: "POST" }),
    cancel: (id: string, reason?: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    preview: (id: string, newPlanId: string) =>
      request<ProrationPreview>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/preview`, {
        method: "POST",
        body: JSON.stringify({ new_plan_id: newPlanId }),
      }),
  };

  readonly invoices = {
    list: () =>
      request<Invoice[]>(this.baseUrl, this.apiKey, "/v1/invoices"),
    get: (id: string) =>
      request<Invoice>(this.baseUrl, this.apiKey, `/v1/invoices/${id}`),
    retry: (id: string) =>
      request<Invoice>(this.baseUrl, this.apiKey, `/v1/invoices/${id}/retry`, { method: "POST" }),
  };

  readonly paymentMethods = {
    create: (input: CreatePaymentMethodInput) =>
      request<PaymentMethod>(this.baseUrl, this.apiKey, "/v1/payment-methods", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    list: (customerId?: string) =>
      request<PaymentMethod[]>(this.baseUrl, this.apiKey, `/v1/payment-methods${customerId ? `?customer_id=${customerId}` : ""}`),
    get: (id: string) =>
      request<PaymentMethod>(this.baseUrl, this.apiKey, `/v1/payment-methods/${id}`),
    delete: (id: string) =>
      request<{ id: string; deleted: boolean }>(this.baseUrl, this.apiKey, `/v1/payment-methods/${id}`, {
        method: "DELETE",
      }),
  };

  readonly webhooks = {
    createEndpoint: (url: string) =>
      request<WebhookEndpoint>(this.baseUrl, this.apiKey, "/v1/webhooks/endpoints", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    listEndpoints: () =>
      request<WebhookEndpoint[]>(this.baseUrl, this.apiKey, "/v1/webhooks/endpoints"),
    getEndpoint: (id: string) =>
      request<WebhookEndpoint>(this.baseUrl, this.apiKey, `/v1/webhooks/endpoints/${id}`),
    updateEndpoint: (id: string, url: string) =>
      request<WebhookEndpoint>(this.baseUrl, this.apiKey, `/v1/webhooks/endpoints/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ url }),
      }),
    deleteEndpoint: (id: string) =>
      request<{ id: string; deleted: boolean }>(this.baseUrl, this.apiKey, `/v1/webhooks/endpoints/${id}`, {
        method: "DELETE",
      }),
    listEvents: () =>
      request<Record<string, unknown>[]>(this.baseUrl, this.apiKey, "/v1/webhooks/events"),
    listDeliveries: () =>
      request<Record<string, unknown>[]>(this.baseUrl, this.apiKey, "/v1/webhooks/deliveries"),
  };
}
