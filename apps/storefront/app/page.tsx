"use client";

import { useState } from "react";

const PLANS = [
  {
    id: "plan_starter",
    name: "Starter",
    price: "₦9,900",
    amount: 990000,
    features: ["HD streaming", "1 device", "30M song catalog", "Basic support"],
    color: "#6366f1",
  },
  {
    id: "plan_growth",
    name: "Growth",
    price: "₦29,900",
    amount: 2990000,
    features: ["4K streaming", "3 devices", "Offline downloads", "Priority support", "Ad-free"],
    color: "#8b5cf6",
    popular: true,
  },
  {
    id: "plan_pro",
    name: "Pro",
    price: "₦79,900",
    amount: 7990000,
    features: ["Lossless audio", "6 devices", "Family sharing", "24/7 VIP support", "Early access"],
    color: "#a855f7",
  },
];

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0b 0%, #18181b 100%)",
    padding: "48px 24px",
  },
  header: {
    display: "flex",
    flexDirection: "row" as const,
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: 900,
    margin: "0 auto 48px",
    flexWrap: "wrap",
    gap: 16,
  },
  logo: { fontSize: 28, fontWeight: 800, letterSpacing: "-0.5px" },
  badge: {
    padding: "6px 14px",
    background: "rgba(99, 102, 241, 0.15)",
    border: "1px solid rgba(99, 102, 241, 0.3)",
    borderRadius: 20,
    fontSize: 13,
    color: "#a5b4fc",
    fontWeight: 600,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, maxWidth: 900, margin: "0 auto" },
  card: {
    background: "rgba(24, 24, 27, 0.8)",
    border: "1px solid rgba(39, 39, 42, 0.8)",
    borderRadius: 16,
    padding: 28,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
    transition: "all 0.2s",
    position: "relative" as const,
  },
  popularBadge: {
    position: "absolute" as const,
    top: -10,
    right: 16,
    padding: "4px 12px",
    background: "#8b5cf6",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
    color: "#fff",
  },
  planName: { fontSize: 20, fontWeight: 700 },
  planPrice: { fontSize: 32, fontWeight: 800 },
  featureList: { display: "flex", flexDirection: "column" as const, gap: 8, margin: 0, padding: 0, listStyle: "none", fontSize: 14, flex: 1 },
  featureItem: { color: "#a1a1aa" },
  button: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 10,
    border: "none",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    color: "#fff",
    transition: "all 0.15s",
  },
  footer: { textAlign: "center" as const, marginTop: 48, color: "#52525b", fontSize: 13 },
};

export default function StorefrontPage() {
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [success, setSuccess] = useState("");

  const handleSubscribe = async (planId: string) => {
    setSubscribing(planId);
    const plan = PLANS.find((p) => p.id === planId);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const email = `demo-${Date.now()}@naijamusic.pro`;

      const regRes = await fetch(`${API}/v1/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Demo User", email, password: "demo123456" }),
      });
      const reg = await regRes.json();
      const key = reg.data?.api_key;
      if (!key) throw new Error(`Register failed: ${JSON.stringify(reg).slice(0,100)}`);

      const planAmount = Math.round((plan?.amount ?? 0) / 100);

      const planRes = await fetch(`${API}/v1/plans`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ name: plan?.name ?? planId, description: plan?.name ?? planId, amount: planAmount, currency: "NGN", interval: "monthly", interval_count: 1 }),
      });
      const p = await planRes.json();
      if (!p.data?.id) throw new Error(`Plan failed: ${JSON.stringify(p).slice(0,100)}`);

      const custRes = await fetch(`${API}/v1/customers`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ name: "Demo Customer", email }),
      });
      const c = await custRes.json();
      if (!c.data?.id) throw new Error(`Customer failed: ${JSON.stringify(c).slice(0,100)}`);

      const subRes = await fetch(`${API}/v1/subscriptions`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ customer_id: c.data.id, plan_id: p.data.id, start_date: new Date().toISOString() }),
      });
      const s = await subRes.json();
      if (!s.data?.id) throw new Error(`Subscription failed: ${JSON.stringify(s).slice(0,100)}`);

      setSuccess(`Subscribed to ${plan?.name}! Subscription active (${s.data.state}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSuccess(`${plan?.name}: ${msg}`);
    }
    setTimeout(() => { setSubscribing(null); setTimeout(() => setSuccess(""), 3000); }, 2000);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header as React.CSSProperties}>
        <div>
          <h1 style={{ ...styles.logo, background: "linear-gradient(135deg, #818cf8, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Naija Music Pro
          </h1>
          <p style={{ color: "#71717a", marginTop: 4, fontSize: 15 }}>Premium Nigerian streaming. Powered by RailSwitch.</p>
        </div>
        <span style={styles.badge}>Subscriptions API</span>
      </div>

      {success && (
        <div style={{ maxWidth: 900, margin: "0 auto 24px", padding: "12px 18px", background: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.3)", borderRadius: 12, color: "#4ade80", fontSize: 14, fontWeight: 600 }}>
          {success}
        </div>
      )}

      <div style={styles.grid}>
        {PLANS.map((plan) => (
          <div key={plan.id} style={styles.card as React.CSSProperties}>
            {plan.popular && <span style={styles.popularBadge}>Most Popular</span>}
            <div>
              <h2 style={styles.planName}>{plan.name}</h2>
              <p style={{ ...styles.planPrice, color: plan.color }}>{plan.price}<span style={{ fontSize: 14, fontWeight: 400, color: "#71717a" }}>/mo</span></p>
            </div>
            <ul style={styles.featureList}>
              {plan.features.map((f) => (
                <li key={f} style={styles.featureItem}>✓ {f}</li>
              ))}
            </ul>
            <button
              style={{ ...styles.button, background: plan.color, opacity: subscribing === plan.id ? 0.6 : 1 }}
              disabled={subscribing !== null}
              onClick={() => handleSubscribe(plan.id)}
            >
              {subscribing === plan.id ? "Redirecting..." : "Subscribe"}
            </button>
          </div>
        ))}
      </div>

      <p style={styles.footer}>
        Secured by RailSwitch — smart payment recovery for Nigerian businesses.
      </p>
    </div>
  );
}
