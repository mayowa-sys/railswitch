export const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3100";
export const PORTAL_API_KEY = "sk_test_mer_HfDzRi_p6G___5GjJ2qsjwpi1eRVU0Hw-2GvTEc";

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
