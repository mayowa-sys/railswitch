const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const IS_MOCK = process.env.NEXT_PUBLIC_MOCK_API !== "false";

async function request<T>(path: string, apiKey: string, opts: RequestInit = {}): Promise<T> {
  if (IS_MOCK) throw new Error("Mock mode");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...opts,
    headers: { ...opts.headers, "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as T;
}

export interface GatewaySubscription {
  id: string;
  merchant_id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
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
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const api = {
  subscriptions: {
    list: (apiKey: string) =>
      request<GatewaySubscription[]>("/v1/subscriptions", apiKey),
    get: (id: string, apiKey: string) =>
      request<GatewaySubscription>(`/v1/subscriptions/${id}`, apiKey),
  },
  plans: {
    list: (apiKey: string) =>
      request<GatewayPlan[]>("/v1/plans", apiKey),
  },
  invoices: {
    list: (apiKey: string) =>
      request<GatewayInvoice[]>("/v1/invoices", apiKey),
  },
  preview: (subId: string, newPlanId: string, apiKey: string) =>
    request<Record<string, unknown>>(`/v1/subscriptions/${subId}/preview`, apiKey, {
      method: "POST",
      body: JSON.stringify({ new_plan_id: newPlanId }),
    }),
  paymentMethods: {
    list: (customerId: string, apiKey: string) =>
      request<Array<Record<string, unknown>>>(`/v1/payment-methods?customer_id=${customerId}`, apiKey),
    create: (data: Record<string, unknown>, apiKey: string) =>
      request<Record<string, unknown>>("/v1/payment-methods", apiKey, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    remove: (id: string, apiKey: string) =>
      request<Record<string, unknown>>(`/v1/payment-methods/${id}`, apiKey, { method: "DELETE" }),
  },
};

export function isMockMode() { return IS_MOCK; }
