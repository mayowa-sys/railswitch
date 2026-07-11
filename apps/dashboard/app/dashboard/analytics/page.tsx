"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);
  const [arr, setArr] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [churnRate, setChurnRate] = useState("0.0");
  const [recoveryRate, setRecoveryRate] = useState("100.0");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [recoveryFees, setRecoveryFees] = useState(0);
  const [recoveredAmount, setRecoveredAmount] = useState(0);
  const [monthlyData, setMonthlyData] = useState<{ label: string; revenue: number }[]>([]);
  const [planData, setPlanData] = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [stateData, setStateData] = useState<{ state: string; count: number; color: string }[]>([]);
  const [mrrBreakdown, setMrrBreakdown] = useState<{ label: string; amount: number; color: string }[]>([]);
  const [healthData, setHealthData] = useState({ paid: 0, failed: 0, retrying: 0, pastDue: 0 });

  useEffect(() => {
    const key = user?.apiKey ?? "";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!key) { setLoading(false); return; }
    const API = process.env.NEXT_PUBLIC_API_URL || "";
    const h = { headers: { Authorization: `Bearer ${key}` } };

    Promise.all([
      fetch(`${API}/v1/subscriptions`, h).then(r => r.json()),
      fetch(`${API}/v1/plans`, h).then(r => r.json()),
      fetch(`${API}/v1/invoices`, h).then(r => r.json()),
      fetch(`${API}/v1/customers`, h).then(r => r.json()),
    ]).then(([sRes, pRes, iRes, cRes]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subs: any[] = sRes.data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plans: any[] = pRes.data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoices: any[] = iRes.data ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customers: any[] = cRes.data ?? [];

      const planMap = new Map(plans.filter(p => !p.name.startsWith('[deleted]') && !p.name.startsWith('Test ')).map(p => [p.id, p]));
      const active = subs.filter(s => s.state === "active");
      const cancelled = subs.filter(s => s.state === "cancelled");

      // MRR
      const m = active.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100;
      setMrr(m);
      setArr(m * 12);
      setActiveCount(active.length);

      // Churn
      setChurnRate(subs.length > 0 ? ((cancelled.length / subs.length) * 100).toFixed(1) : "0.0");

      // Recovery
      const paid = invoices.filter(i => i.status === "paid").length;
      const uncollectible = invoices.filter(i => i.status === "uncollectible").length;
      const total = paid + uncollectible;
      setRecoveryRate(total > 0 ? ((paid / total) * 100).toFixed(1) : "100.0");
      setTotalRevenue(invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.amount ?? 0), 0) / 100);

      // Recovery fees (5% of recovered revenue)
      const totalRecoveryFees = invoices
        .filter(i => i.status === "paid")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reduce((sum, i) => sum + Number((i.metadata as any)?.recovery_fee ?? 0), 0) / 100;

      const totalRecovered = invoices
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter(i => i.status === "paid" && (i.metadata as any)?.recovery_fee)
        .reduce((sum, i) => sum + Number(i.amount ?? 0), 0) / 100;

      setRecoveryFees(totalRecoveryFees);
      setRecoveredAmount(totalRecovered);

      // Health
      const retrying = subs.filter(s => ["retrying", "va_fallback", "whatsapp_fallback"].includes(s.state));
      const pastDue = subs.filter(s => s.state === "past_due");
      setHealthData({ paid, failed: uncollectible, retrying: retrying.length, pastDue: pastDue.length });

      // Monthly revenue (12 months)
      const months: { label: string; revenue: number }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString("en-NG", { month: "short", year: "2-digit" });
        const monthInvs = invoices.filter(inv => {
          if (inv.status !== "paid" || !inv.paid_at) return false;
          const pd = new Date(inv.paid_at);
          return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
        });
        const rev = monthInvs.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0) / 100;
        months.push({ label, revenue: rev });
      }
      setMonthlyData(months);

      // Plan distribution (active only)
      const pd: Record<string, { count: number; revenue: number }> = {};
      for (const s of active) {
        const p = planMap.get(s.plan_id);
        if (!p) continue;
        if (!pd[p.name]) pd[p.name] = { count: 0, revenue: 0 };
        pd[p.name].count++;
        pd[p.name].revenue += Number(p.amount) / 100;
      }
      setPlanData(Object.entries(pd).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue));

      // State distribution
      const sd: Record<string, number> = {};
      for (const s of subs) sd[s.state] = (sd[s.state] ?? 0) + 1;
      const stateColors: Record<string, string> = {
        active: "#10b981", paused: "#f59e0b", cancelled: "#ef4444", trialing: "#3b82f6",
        retrying: "#f97316", va_fallback: "#8b5cf6", whatsapp_fallback: "#06b6d4", past_due: "#f43f5e",
      };
      setStateData(Object.entries(sd).map(([state, count]) => ({
        state, count, color: stateColors[state] ?? "#71717a",
      })).sort((a, b) => b.count - a.count));

      // MRR breakdown
      const mrrByStatus = [
        { label: "Collected", amount: m, color: "#10b981" },
        { label: "In Recovery", amount: retrying.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100, color: "#f97316" },
        { label: "Past Due", amount: pastDue.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100, color: "#f43f5e" },
        { label: "Paused", amount: subs.filter(s => s.state === "paused").reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100, color: "#f59e0b" },
      ].filter(s => s.amount > 0);
      setMrrBreakdown(mrrByStatus);

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Subscription analytics and revenue insights." />
        <div className="flex items-center justify-center py-24 text-sm text-zinc-400">Loading analytics...</div>
      </div>
    );
  }

  const maxMonthly = Math.max(...monthlyData.map(m => m.revenue), 1);
  const maxPlanRevenue = Math.max(...planData.map(p => p.revenue), 1);
  const maxMrrStatus = Math.max(...mrrBreakdown.map(s => s.amount), 1);
  const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : n.toFixed(0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Subscription analytics and revenue insights." />

      {/* KPI Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <KpiCard label="MRR" value={`₦${Math.round(mrr).toLocaleString()}`} sub={`ARR: ₦${Math.round(arr).toLocaleString()}`} accent="indigo" />
        <KpiCard label="Active Subscribers" value={String(activeCount)} sub={`${churnRate}% churn`} accent="emerald" />
        <KpiCard label="Recovery Rate" value={`${recoveryRate}%`} sub={`${healthData.paid} of ${healthData.paid + healthData.failed} charges`} accent="violet" />
        <KpiCard label="Total Revenue" value={`₦${Math.round(totalRevenue).toLocaleString()}`} sub={`${healthData.paid + healthData.failed} paid invoices`} accent="amber" />
        <KpiCard label="Platform Fees (5%)" value={recoveryFees > 0 ? `₦${Math.round(recoveryFees).toLocaleString()}` : "—"} sub={recoveryFees > 0 && recoveredAmount > 0 ? `${((recoveryFees / recoveredAmount) * 100).toFixed(0)}% of recovered` : "Pending first recovery"} accent="rose" />
      </div>

      {/* Health Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <HealthCard label="Successful" value={healthData.paid} color="#10b981" total={healthData.paid + healthData.failed} />
        <HealthCard label="In Recovery" value={healthData.retrying} color="#f97316" />
        <HealthCard label="Past Due" value={healthData.pastDue} color="#f43f5e" />
        <HealthCard label="Failed" value={healthData.failed} color="#ef4444" />
      </div>

      {/* Revenue Chart + MRR Breakdown */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
          <h3 className="text-sm font-semibold mb-1">Revenue Trend</h3>
          <p className="text-xs text-zinc-400 mb-6">Monthly collected revenue (12 months)</p>
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-6 w-12 flex flex-col justify-between text-right pr-2">
              <span className="text-[10px] text-zinc-400 tabular-nums">{fmt(maxMonthly)}</span>
              <span className="text-[10px] text-zinc-400 tabular-nums">{fmt(maxMonthly * 0.75)}</span>
              <span className="text-[10px] text-zinc-400 tabular-nums">{fmt(maxMonthly * 0.5)}</span>
              <span className="text-[10px] text-zinc-400 tabular-nums">{fmt(maxMonthly * 0.25)}</span>
              <span className="text-[10px] text-zinc-400 tabular-nums">0</span>
            </div>
            {/* Grid lines */}
            <div className="ml-14 relative h-48">
              {[0, 25, 50, 75, 100].map(pct => (
                <div key={pct} className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800" style={{ bottom: `${pct}%` }} />
              ))}
              {/* Bars */}
              <div className="absolute inset-0 flex items-end gap-1">
                {monthlyData.map((m, i) => {
                  const h = Math.max((m.revenue / maxMonthly) * 100, 1);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap tabular-nums z-10">
                        ₦{m.revenue.toLocaleString()}
                      </div>
                      <div
                        className="w-full rounded-t-sm transition-colors"
                        style={{
                          height: `${h}%`,
                          background: i === monthlyData.length - 1 ? "#818cf8" : "#6366f1",
                          opacity: i === monthlyData.length - 1 ? 0.7 : 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* X-axis labels */}
            <div className="ml-14 flex gap-1 mt-2">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 text-center">
                  <span className="text-[10px] text-zinc-400">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MRR Breakdown */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
          <h3 className="text-sm font-semibold mb-1">MRR by Status</h3>
          <p className="text-xs text-zinc-400 mb-6">How your recurring revenue breaks down</p>
          <div className="space-y-5">
            {mrrBreakdown.map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-zinc-500">{s.label}</span>
                  <span className="text-xs font-semibold tabular-nums">₦{Math.round(s.amount).toLocaleString()}</span>
                </div>
                <div className="h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(s.amount / maxMrrStatus) * 100}%`, backgroundColor: s.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between">
            <span className="text-xs font-medium text-zinc-500">Total MRR</span>
            <span className="text-sm font-bold tabular-nums">₦{Math.round(mrr).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-1">Revenue by Plan</h3>
        <p className="text-xs text-zinc-400 mb-5">Active subscription revenue per plan</p>
        <div className="space-y-3">
          {planData.map(p => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="text-sm w-28 truncate font-medium">{p.name}</span>
              <div className="flex-1 h-7 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden relative">
                <div
                  className="h-full rounded-md flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max((p.revenue / maxPlanRevenue) * 100, 6)}%`,
                    background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
                  }}
                >
                  <span className="text-[10px] text-white font-medium tabular-nums">
                    ₦{p.revenue.toLocaleString()}
                  </span>
                </div>
              </div>
              <span className="text-xs text-zinc-400 w-16 text-right tabular-nums">{p.count} subs</span>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription States */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-1">Subscription Lifecycle</h3>
        <p className="text-xs text-zinc-400 mb-5">All subscriptions by current state</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {stateData.map(s => (
            <div key={s.state} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-4 text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: s.color }} />
              <p className="text-2xl font-bold tabular-nums mt-1">{s.count}</p>
              <p className="text-[11px] text-zinc-400 capitalize mt-1 font-medium">{s.state.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  const bg: Record<string, string> = {
    indigo: "from-indigo-600 to-violet-600",
    emerald: "from-emerald-600 to-teal-600",
    violet: "from-violet-600 to-purple-600",
    amber: "from-amber-500 to-orange-500",
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${bg[accent] ?? bg.indigo} p-5 text-white shadow-lg`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs opacity-70 mt-1">{sub}</p>
    </div>
  );
}

function HealthCard({ label, value, color, total }: { label: string; value: number; color: string; total?: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      {total !== undefined && (
        <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${(value / Math.max(total, 1)) * 100}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}
