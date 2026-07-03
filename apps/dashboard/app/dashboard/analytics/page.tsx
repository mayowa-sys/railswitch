"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";

interface AnalyticsData {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  churnRate: string;
  recoveryRate: string;
  totalRevenue: number;
  planDistribution: { name: string; count: number; revenue: number }[];
  stateDistribution: { state: string; count: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = user?.apiKey ?? "";
    if (!key) return;

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    Promise.all([
      fetch(`${API}/v1/subscriptions`, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json()),
      fetch(`${API}/v1/plans`, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json()),
      fetch(`${API}/v1/invoices`, { headers: { Authorization: `Bearer ${key}` } }).then(r => r.json()),
    ]).then(([subsRes, plansRes, invRes]) => {
      const subs = subsRes.data ?? [];
      const plans = plansRes.data ?? [];
      const invoices = invRes.data ?? [];

      const planMap = new Map(plans.map((p: any) => [p.id, p]));
      const activeSubs = subs.filter((s: any) => s.state === "active" || s.state === "charging");
      const cancelledSubs = subs.filter((s: any) => s.state === "cancelled");

      // MRR
      const mrr = activeSubs.reduce((sum: number, s: any) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100;

      // Plan distribution
      const planDist: Record<string, { count: number; revenue: number }> = {};
      for (const s of activeSubs) {
        const plan = planMap.get(s.plan_id);
        const name = plan?.name ?? "Unknown";
        if (!planDist[name]) planDist[name] = { count: 0, revenue: 0 };
        planDist[name].count++;
        planDist[name].revenue += Number(plan?.amount ?? 0) / 100;
      }
      const planDistribution = Object.entries(planDist).map(([name, v]) => ({ name, ...v }));

      // State distribution
      const stateDist: Record<string, number> = {};
      for (const s of subs) {
        stateDist[s.state] = (stateDist[s.state] ?? 0) + 1;
      }
      const stateDistribution = Object.entries(stateDist).map(([state, count]) => ({ state, count }));

      // Recovery rate
      const paid = invoices.filter((i: any) => i.status === "paid").length;
      const uncollectible = invoices.filter((i: any) => i.status === "uncollectible").length;
      const recoveryRate = paid + uncollectible > 0 ? ((paid / (paid + uncollectible)) * 100).toFixed(1) : "100.0";

      // Monthly revenue (last 6 months)
      const monthlyRevenue: { month: string; revenue: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = d.toLocaleString("default", { month: "short", year: "numeric" });
        const monthPaid = invoices.filter((inv: any) => {
          if (inv.status !== "paid" || !inv.paid_at) return false;
          const paidDate = new Date(inv.paid_at);
          return paidDate.getMonth() === d.getMonth() && paidDate.getFullYear() === d.getFullYear();
        });
        const revenue = monthPaid.reduce((sum: number, inv: any) => sum + Number(inv.amount ?? 0), 0) / 100;
        monthlyRevenue.push({ month: monthStr, revenue });
      }

      setData({
        mrr,
        arr: mrr * 12,
        activeSubscribers: activeSubs.length,
        churnRate: subs.length > 0 ? ((cancelledSubs.length / subs.length) * 100).toFixed(1) : "0.0",
        recoveryRate,
        totalRevenue: invoices.filter((i: any) => i.status === "paid").reduce((sum: number, i: any) => sum + Number(i.amount ?? 0), 0) / 100,
        planDistribution,
        stateDistribution,
        monthlyRevenue,
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Subscription analytics and revenue insights." />
        <div className="text-center py-12 text-sm text-zinc-400">Loading analytics...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Subscription analytics and revenue insights." />
        <div className="text-center py-12 text-sm text-zinc-400">Failed to load analytics.</div>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.monthlyRevenue.map(m => m.revenue), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Subscription analytics and revenue insights." />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">MRR</p>
          <p className="mt-2 text-2xl font-bold">₦{data.mrr.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">ARR: ₦{data.arr.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Active Subscribers</p>
          <p className="mt-2 text-2xl font-bold">{data.activeSubscribers}</p>
          <p className="text-[11px] text-zinc-400 mt-1">Churn: {data.churnRate}%</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Recovery Rate</p>
          <p className="mt-2 text-2xl font-bold">{data.recoveryRate}%</p>
          <p className="text-[11px] text-zinc-400 mt-1">Cards recovered / failed</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <p className="text-xs text-zinc-400 uppercase tracking-wider">Total Revenue</p>
          <p className="mt-2 text-2xl font-bold">₦{data.totalRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">All-time paid invoices</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-4">Revenue Trend (6 months)</h3>
        <div className="flex items-end gap-3 h-40">
          {data.monthlyRevenue.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-zinc-400">₦{(m.revenue / 1000).toFixed(0)}k</span>
              <div
                className="w-full bg-indigo-500 rounded-t"
                style={{ height: `${(m.revenue / maxRevenue) * 100}%`, minHeight: 4 }}
              />
              <span className="text-[10px] text-zinc-400">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-4">Plan Distribution</h3>
        <div className="space-y-3">
          {data.planDistribution.sort((a, b) => b.revenue - a.revenue).map((p) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="text-sm w-24 truncate">{p.name}</span>
              <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-4">
                <div
                  className="bg-indigo-500 rounded-full h-4"
                  style={{ width: `${(p.count / data.activeSubscribers) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-zinc-500 w-16 text-right">{p.count} subs</span>
              <span className="text-[11px] text-zinc-400 w-20 text-right">₦{p.revenue.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* State Distribution */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-4">Subscription States</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {data.stateDistribution.sort((a, b) => b.count - a.count).map((s) => (
            <div key={s.state} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-3 text-center">
              <p className="text-lg font-bold">{s.count}</p>
              <p className="text-[11px] text-zinc-400 capitalize">{s.state.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
