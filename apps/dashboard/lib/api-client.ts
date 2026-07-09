// API client wrapper — typed fetch calls to the RailSwitch gateway.
//
// Swaps between mock and real mode via NEXT_PUBLIC_MOCK_API env var.
// When the gateway auth is live, import and use the user's apiKey from AuthContext
// to authenticate requests.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_API !== "false";

interface RequestConfig extends Omit<RequestInit, "body"> {
  body?: unknown;
  apiKey?: string;
}

async function request<T = unknown>(
  path: string,
  config: RequestConfig = {},
): Promise<T> {
  const { body, apiKey, headers: extraHeaders, ...rest } = config;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text();
    let message: string;
    try {
      const parsed = JSON.parse(errBody);
      message = parsed.error?.message ?? parsed.detail ?? res.statusText;
    } catch {
      message = errBody || res.statusText;
    }
    throw new ApiError(res.status, message);
  }

  const json = await res.json();
  // Gateway wraps responses in { data, error, meta } envelope.
  return (json.data ?? json) as T;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ---------- types ----------

export interface GatewayPlan {
  id: string;
  merchant_id: string;
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

export interface GatewaySubscription {
  id: string;
  merchant_id: string;
  customer_id: string;
  plan_id: string;
  state: string;
  current_period_start: string;
  current_period_end: string;
  trial_ends_at?: string;
  cancel_at_period_end: boolean;
  next_billing_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  cascade_history?: Array<{ step: string; status: string; attempted_at?: string }>;
}

export interface GatewayCustomer {
  id: string;
  merchant_id: string;
  name: string;
  email: string;
  phone?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}


export interface GatewayAuditEntry {
  id: string;
  merchant_id: string;
  subscription_id: string;
  from_state: string;
  to_state: string;
  actor: string;
  reason: string;
  timestamp: string;
}

export interface GatewayWebhookEndpoint {
  id: string;
  merchant_id: string;
  url: string;
  status: string;
  secret?: string;
  last_delivery_at: string | null;
  created_at: string;
}

export interface GatewayWebhookEvent {
  id: string;
  merchant_id: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface GatewayWebhookDelivery {
  id: string;
  endpoint_id: string;
  event_id: string;
  merchant_id: string;
  status: string;
  status_code: number | null;
  attempts: number;
  delivered_at: string | null;
  created_at: string;
}
export interface GatewayInvoice {
  id: string;
  status: string;
  subscription_id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  description?: string;
  due_date: string;
  paid_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ---------- API surface ----------

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ merchant: { id: string; name: string; email: string; company: string }; api_key_prefix: string }>(
        "/v1/auth/login",
        { method: "POST", body: { email, password } },
      ),
    register: (name: string, email: string, password: string) =>
      request<{ merchant: { id: string; name: string; email: string; company: string }; api_key: string }>(
        "/v1/auth/register",
        { method: "POST", body: { name, email, password } },
      ),
  },

  plans: {
    list: (apiKey: string) =>
      request<GatewayPlan[]>("/v1/plans", { apiKey }),
    get: (id: string, apiKey: string) =>
      request<GatewayPlan>(`/v1/plans/${id}`, { apiKey }),
    create: (data: Record<string, unknown>, apiKey: string) =>
      request<GatewayPlan>("/v1/plans", { method: "POST", body: data, apiKey }),
    update: (id: string, data: Record<string, unknown>, apiKey: string) =>
      request<GatewayPlan>(`/v1/plans/${id}`, { method: "PATCH", body: data, apiKey }),
  },

  subscriptions: {
    list: (apiKey: string) =>
      request<GatewaySubscription[]>("/v1/subscriptions", { apiKey }),
    get: (id: string, apiKey: string) =>
      request<GatewaySubscription>(`/v1/subscriptions/${id}`, { apiKey }),
    create: (data: Record<string, unknown>, apiKey: string) =>
      request<GatewaySubscription>("/v1/subscriptions", { method: "POST", body: data, apiKey }),
  },

  customers: {
    list: (apiKey: string) =>
      request<GatewayCustomer[]>("/v1/customers", { apiKey }),
    get: (id: string, apiKey: string) =>
      request<GatewayCustomer>(`/v1/customers/${id}`, { apiKey }),
    create: (data: Record<string, unknown>, apiKey: string) =>
      request<GatewayCustomer>("/v1/customers", { method: "POST", body: data, apiKey }),
  },

  invoices: {
    list: (apiKey: string) =>
      request<GatewayInvoice[]>("/v1/invoices", { apiKey }),
  },

  health: () => request<{ status: string }>("/health"),
  webhooks: {
    endpoints: {
      list: (apiKey: string) =>
        request<GatewayWebhookEndpoint[]>("/v1/webhooks/endpoints", { apiKey }),
      create: (url: string, apiKey: string) =>
        request<GatewayWebhookEndpoint>("/v1/webhooks/endpoints", { method: "POST", body: { url }, apiKey }),
      remove: (id: string, apiKey: string) =>
        request<{ id: string; disabled: boolean }>(`/v1/webhooks/endpoints/${id}`, { method: "DELETE", apiKey }),
    },
    events: {
      list: (apiKey: string) =>
        request<GatewayWebhookEvent[]>("/v1/webhooks/events", { apiKey }),
    },
    deliveries: {
      list: (apiKey: string) =>
        request<GatewayWebhookDelivery[]>("/v1/webhooks/deliveries", { apiKey }),
      replay: (id: string, apiKey: string) =>
        request<{ id: string; replayed: boolean }>(`/v1/webhooks/deliveries/${id}/replay`, { method: "POST", apiKey }),
    },
  },

  auditLogs: {
    list: (apiKey: string) =>
      request<GatewayAuditEntry[]>("/v1/audit-logs", { apiKey }),
    forSubscription: (subscriptionId: string, apiKey: string) =>
      request<GatewayAuditEntry[]>(`/v1/audit-logs/subscription/${subscriptionId}`, { apiKey }),
  },

};

/** Check whether the app is running against mock APIs. */
export function isMockMode(): boolean {
  return IS_MOCK;
}
