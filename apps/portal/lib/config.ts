
export interface PortalCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  created_at: string;
}
export const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3100";
export const PORTAL_API_KEY = "sk_test_mer_Jrh7prq25H__LdcbgIggue0HbHscrLYO3zhZy1g";

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

export async function resolveToken(token: string): Promise<{ customer: Record<string, unknown>; merchant_id: string } | null> {
  try {
    const res = await fetch(`${PORTAL_API_URL}/v1/portal/resolve?token=${token}`);
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}
