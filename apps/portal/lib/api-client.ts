const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, apiKey: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { ...opts.headers, "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `API ${res.status}`);
  }
  const json = await res.json();
  return (json.data ?? json) as T;
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
}

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

export interface GatewayInvoice {
  id: string;
  subscription_id: string;
  merchant_id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  due_date: string;
  paid_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface GatewayPaymentMethod {
  id: string;
  customer_id: string;
  type: string;
  nomba_token: string;
  last4: string;
  brand: string;
  is_default: boolean;
  created_at: string;
}

export const api = {
  subscriptions: {
    list: (apiKey: string) => request<GatewaySubscription[]>("/v1/subscriptions", apiKey),
    get: (id: string, apiKey: string) => request<GatewaySubscription>(`/v1/subscriptions/${id}`, apiKey),
    preview: (subId: string, newPlanId: string, apiKey: string) =>
      request<Record<string, unknown>>(`/v1/subscriptions/${subId}/preview`, apiKey, {
        method: "POST",
        body: JSON.stringify({ new_plan_id: newPlanId }),
      }),
    pause: (id: string, apiKey: string) => request<Record<string, unknown>>(`/v1/subscriptions/${id}/pause`, apiKey, { method: "POST" }),
    resume: (id: string, apiKey: string) => request<Record<string, unknown>>(`/v1/subscriptions/${id}/resume`, apiKey, { method: "POST" }),
    cancel: (id: string, apiKey: string) => request<Record<string, unknown>>(`/v1/subscriptions/${id}/cancel`, apiKey, { method: "POST" }),
    changePlan: (id: string, planId: string, apiKey: string) =>
      request<Record<string, unknown>>(`/v1/subscriptions/${id}`, apiKey, {
        method: "PATCH",
        body: JSON.stringify({ plan_id: planId }),
      }),
  },
  plans: {
    list: (apiKey: string) => request<GatewayPlan[]>("/v1/plans", apiKey),
  },
  invoices: {
    list: (apiKey: string) => request<GatewayInvoice[]>("/v1/invoices", apiKey),
  },
  paymentMethods: {
    list: (customerId: string, apiKey: string) =>
      request<GatewayPaymentMethod[]>(`/v1/payment-methods?customer_id=${customerId}`, apiKey),
    create: (data: Record<string, unknown>, apiKey: string) =>
      request<GatewayPaymentMethod>("/v1/payment-methods", apiKey, { method: "POST", body: JSON.stringify(data) }),
    remove: (id: string, apiKey: string) =>
      request<Record<string, unknown>>(`/v1/payment-methods/${id}`, apiKey, { method: "DELETE" }),
  },
};

export function isMockMode() { return false; }
