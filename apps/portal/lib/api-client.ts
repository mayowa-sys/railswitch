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

export const api = {
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
