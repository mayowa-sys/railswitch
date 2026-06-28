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
  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  name: string;
  amount: number;
  interval: string;
  currency?: string;
  description?: string;
  interval_count?: number;
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
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
  status: string;
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

export interface PrerationPreview {
  current_plan: { id: string; name: string; amount: number; interval: string };
  new_plan: { id: string; name: string; amount: number; interval: string };
  credit: { amount: number; description: string };
  charge: { amount: number; description: string };
  net_amount: number;
  remaining_days: number;
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
  };

  readonly customers = {
    create: (input: CreateCustomerInput) =>
      request<Customer>(this.baseUrl, this.apiKey, "/v1/customers", {
        method: "POST",
        body: JSON.stringify(input),
      }),
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
    update: (id: string, input: Record<string, unknown>) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    pause: (id: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/pause`, { method: "POST" }),
    resume: (id: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/resume`, { method: "POST" }),
    cancel: (id: string) =>
      request<Subscription>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/cancel`, { method: "POST" }),
    preview: (id: string, newPlanId: string) =>
      request<PrerationPreview>(this.baseUrl, this.apiKey, `/v1/subscriptions/${id}/preview`, {
        method: "POST",
        body: JSON.stringify({ plan: newPlanId }),
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
}
