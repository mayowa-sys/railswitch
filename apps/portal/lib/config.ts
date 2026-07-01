// Portal config — single source of truth for the demo API key.
// In production, the portal would use tokenized access links per customer.
// For the hackathon demo, we use the pre-seeded demo merchant key.

export const PORTAL_API_KEY = "sk_test_mer_p37g-Bwaww__FVAamREwyvnijyV73gk8sacBjmI";
export const PORTAL_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
