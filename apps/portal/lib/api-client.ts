import { PORTAL_API_KEY } from "@/lib/config";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('token');
}

function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { Authorization: `Bearer ${PORTAL_API_KEY}` };
  if (token) headers['x-portal-token'] = token;
  return headers;
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(opts.headers as Record<string, string> || {}),
  }
  
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(`API ${res.status}`);
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
  va_id?: string;
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
  last4: string;
  brand: string;
  is_default: boolean;
  created_at: string;
}

export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export const api = {
  portal: {
    resolve: () => {
      const token = getToken();
      if (!token) return Promise.reject(new Error('No token'));
      return request<{ customer: PortalCustomer; merchant_id: string }>(`/v1/portal/resolve?token=${token}`);
    },
  },
  subscriptions: {
    list: () => request<GatewaySubscription[]>("/v1/subscriptions"),
    get: (id: string) => request<GatewaySubscription>(`/v1/subscriptions/${id}`),
    preview: (subId: string, newPlanId: string) =>
      request<Record<string, unknown>>(`/v1/subscriptions/${subId}/preview`, {
        method: "POST",
        body: JSON.stringify({ new_plan_id: newPlanId }),
      }),
    pause: (id: string) => request<Record<string, unknown>>(`/v1/subscriptions/${id}/pause`, { method: "POST" }),
    resume: (id: string) => request<Record<string, unknown>>(`/v1/subscriptions/${id}/resume`, { method: "POST" }),
    cancel: (id: string) => request<Record<string, unknown>>(`/v1/subscriptions/${id}/cancel`, { method: "POST" }),
    changePlan: (id: string, planId: string) =>
      request<Record<string, unknown>>(`/v1/subscriptions/${id}`, { method: "PATCH", body: JSON.stringify({ plan_id: planId }) }),
  },
  plans: {
    list: () => request<GatewayPlan[]>("/v1/plans"),
  },
  invoices: {
    list: () => request<GatewayInvoice[]>("/v1/invoices"),
  },
  paymentMethods: {
    list: (customerId: string) => request<GatewayPaymentMethod[]>(`/v1/payment-methods?customer_id=${customerId}`),
    create: (data: Record<string, unknown>) =>
      request<GatewayPaymentMethod>("/v1/payment-methods", { method: "POST", body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<Record<string, unknown>>(`/v1/payment-methods/${id}`, { method: "DELETE" }),
  },
};
