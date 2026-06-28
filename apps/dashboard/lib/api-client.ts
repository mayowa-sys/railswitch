// API client wrapper — typed fetch calls to the RailSwitch gateway.
//
// Swaps between mock and real mode via NEXT_PUBLIC_MOCK_API env var.
// When the gateway auth is live, import and use the user's apiKey from AuthContext
// to authenticate requests.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  return res.json() as Promise<T>;
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

// ---------- typed API surface ----------

export interface GatewayPlan {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  is_active: boolean;
  created_at: string;
}

export interface GatewaySubscription {
  id: string;
  customer_id: string;
  plan_id: string;
  state: string;
  amount: number;
  created_at: string;
  next_billing_at?: string;
}

export interface GatewayCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export const api = {
  // Plans
  plans: {
    list: (apiKey: string) =>
      request<{ data: GatewayPlan[] }>("/v1/plans", { apiKey }),
  },

  // Customers
  customers: {
    get: (id: string, apiKey: string) =>
      request<{ data: GatewayCustomer }>(`/v1/customers/${id}`, { apiKey }),
  },

  // Health
  health: () => request<{ status: string }>("/health"),
};

/** Check whether the app is running against mock APIs. */
export function isMockMode(): boolean {
  return IS_MOCK;
}
