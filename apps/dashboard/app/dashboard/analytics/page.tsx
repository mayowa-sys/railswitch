"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";
import {
  TrendingUp, TrendingDown, Users, CreditCard, AlertTriangle,
  CheckCircle2, XCircle, Clock, RefreshCw, ArrowUpRight,
} from "lucide-react";

interface AnalyticsData {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  churnRate: string;
  recoveryRate: string;
  totalRevenue: number;
  planDistribution: { name: string; count: number; revenue: number; pct: number }[];
  stateDistribution: { state: string; count: number; color: string }[];
  monthlyRevenue: { month: string; revenue: number; short: string }[];
  paymentHealth: {
    totalCharges: number;
    successful: number;
    failed: number;
    retrying: number;
    pastDue: number;
    avgRecoveryTime: string;
  };
  mrrByStatus: { label: string; amount: number; color: string }[];
}

const STATE_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  paused: "bg-amber-500",
  cancelled: "bg-red-500",
  trialing: "bg-blue-500",
  retrying: "bg-orange-500",
  va_fallback: "bg-purple-500",
  whatsapp_fallback: "bg-cyan-500",
  past_due: "bg-rose-500",
  charging: "bg-indigo-500",
};

const SKIP_PLANS = new Set(["Test cpfg", "Test jjgw"]);

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = user?.apiKey ?? "";
    if (!key) return;

    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const opts = { headers: { Authorization: `Bearer ${key}` } };

    Promise.all([
      fetch(`${API}/v1/subscriptions`, opts).then(r => r.json()),
      fetch(`${API}/v1/plans`, opts).then(r => r.json()),
      fetch(`${API}/v1/invoices`, opts).then(r => r.json()),
    ]).then(([subsRes, plansRes, invRes]) => {
      const subs: any[] = subsRes.data ?? [];
      const plans: any[] = (plansRes.data ?? []).filter((p: any) => !SKIP_PLANS.has(p.name));
      const invoices: any[] = invRes.data ?? [];

      const planMap = new Map(plans.map(p => [p.id, p]));
      const activeSubs = subs.filter(s => s.state === "active");
      const cancelledSubs = subs.filter(s => s.state === "cancelled");

      // MRR from active subs only
      const mrr = activeSubs.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100;

      // Plan distribution (active subs only, exclude test plans)
      const planDist: Record<string, { count: number; revenue: number }> = {};
      for (const s of activeSubs) {
        const plan = planMap.get(s.plan_id);
        if (!plan || SKIP_PLANS.has(plan.name)) continue;
        const name = plan.name;
        if (!planDist[name]) planDist[name] = { count: 0, revenue: 0 };
        planDist[name].count++;
        planDist[name].revenue += Number(plan.amount ?? 0) / 100;
      }
      const planDistribution = Object.entries(planDist)
        .map(([name, v]) => ({ name, ...v, pct: activeSubs.length > 0 ? Math.round((v.count / activeSubs.length) * 100) : 0 }))
        .sort((a, b) => b.revenue - a.revenue);

      // State distribution
      const stateDist: Record<string, number> = {};
      for (const s of subs) stateDist[s.state] = (stateDist[s.state] ?? 0) + 1;
      const stateDistribution = Object.entries(stateDist)
        .map(([state, count]) => ({ state, count, color: STATE_COLORS[state] ?? "bg-zinc-400" }))
        .sort((a, b) => b.count - a.count);

      // Recovery rate (paid vs uncollectible)
      const paid = invoices.filter(i => i.status === "paid").length;
      const uncollectible = invoices.filter(i => i.status === "uncollectible").length;
      const totalFailed = paid + uncollectible;
      const recoveryRate = totalFailed > 0 ? ((paid / totalFailed) * 100).toFixed(1) : "100.0";

      // Payment health
      const failedInvoices = invoices.filter(i => i.status === "uncollectible" || i.status === "open");
      const retryingSubs = subs.filter(s => s.state === "retrying" || s.state === "va_fallback" || s.state === "whatsapp_fallback");
      const pastDueSubs = subs.filter(s => s.state === "past_due");

      // Monthly revenue (last 6 months)
      const monthlyRevenue: { month: string; revenue: number; short: string }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const short = d.toLocaleString("en-NG", { month: "short" });
        const monthStr = `${short} ${d.getFullYear()}`;
        const monthPaid = invoices.filter(inv => {
          if (inv.status !== "paid" || !inv.paid_at) return false;
          const paidDate = new Date(inv.paid_at);
          return paidDate.getMonth() === d.getMonth() && paidDate.getFullYear() === d.getFullYear();
        });
        const revenue = monthPaid.reduce((sum, inv) => sum + Number(inv.amount ?? 0), 0) / 100;
        monthlyRevenue.push({ month: monthStr, revenue, short });
      }

      // Total revenue
      const totalRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.amount ?? 0), 0) / 100;

      // MRR by subscription status
      const mrrByStatus = [
        { label: "Collected (Active)", amount: mrr, color: "bg-emerald-500" },
        { label: "In Recovery", amount: retryingSubs.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100, color: "bg-orange-500" },
        { label: "Past Due", amount: pastDueSubs.reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100, color: "bg-rose-500" },
        { label: "Paused", amount: subs.filter(s => s.state === "paused").reduce((sum, s) => sum + Number(planMap.get(s.plan_id)?.amount ?? 0), 0) / 100, color: "bg-amber-500" },
      ];

      setData({
        mrr,
        arr: mrr * 12,
        activeSubscribers: activeSubs.length,
        churnRate: subs.length > 0 ? ((cancelledSubs.length / subs.length) * 100).toFixed(1) : "0.0",
        recoveryRate,
        totalRevenue,
        planDistribution,
        stateDistribution,
        monthlyRevenue,
        paymentHealth: {
          totalCharges: invoices.length,
          successful: paid,
          failed: uncollectible,
          retrying: retryingSubs.length,
          pastDue: pastDueSubs.length,
          avgRecoveryTime: "2.1 days",
        },
        mrrByStatus,
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
  const maxMrrStatus = Math.max(...data.mrrByStatus.map(s => s.amount), 1);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Subscription analytics and revenue insights." />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">MRR</p>
            <TrendingUp className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">₦{Math.round(data.mrr).toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">ARR: ₦{Math.round(data.arr).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Active Subscribers</p>
            <Users className="size-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{data.activeSubscribers.toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">{data.churnRate}% churn rate</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Recovery Rate</p>
            <RefreshCw className="size-4 text-violet-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{data.recoveryRate}%</p>
          <p className="text-[11px] text-zinc-400 mt-1">{data.paymentHealth.successful} of {data.paymentHealth.totalCharges} charges paid</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Total Revenue</p>
            <CreditCard className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">₦{Math.round(data.totalRevenue).toLocaleString()}</p>
          <p className="text-[11px] text-zinc-400 mt-1">All-time collected invoices</p>
        </div>
      </div>

      {/* Payment Health Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Successful Charges</p>
          </div>
          <p className="text-2xl font-bold tabular-nums">{data.paymentHealth.successful}</p>
          <div className="mt-2 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(data.paymentHealth.successful / Math.max(data.paymentHealth.totalCharges, 1)) * 100}%` }} />
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-orange-500" />
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">In Recovery</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">{data.paymentHealth.retrying}</p>
          <p className="text-[11px] text-zinc-400 mt-2">Subscriptions retrying via cascade</p>
        </div>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-5">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="size-4 text-red-500" />
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Past Due</p>
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{data.paymentHealth.pastDue}</p>
          <p className="text-[11px] text-zinc-400 mt-2">Exceeded retry limit</p>
        </div>
      </div>

      {/* Revenue Chart + MRR by Status */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
          <h3 className="text-sm font-semibold mb-4">Revenue Trend (6 months)</h3>
          <div className="flex items-end gap-2 h-48">
            {data.monthlyRevenue.map((m, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  ₦{m.revenue >= 1000000 ? `${(m.revenue / 1000000).toFixed(1)}M` : m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(0)}k` : m.revenue.toFixed(0)}
                </span>
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-sm transition-all group-hover:from-indigo-500 group-hover:to-indigo-300"
                  style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, 2)}%` }}
                />
                <span className="text-[10px] text-zinc-400 font-medium">{m.short}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
          <h3 className="text-sm font-semibold mb-4">MRR by Status</h3>
          <div className="space-y-4">
            {data.mrrByStatus.filter(s => s.amount > 0).map((s) => (
              <div key={s.label}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-zinc-400">{s.label}</span>
                  <span className="text-xs font-semibold tabular-nums">₦{Math.round(s.amount).toLocaleString()}</span>
                </div>
                <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`${s.color} h-full rounded-full transition-all`} style={{ width: `${(s.amount / maxMrrStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium">Total MRR</span>
              <span className="text-sm font-bold tabular-nums">₦{Math.round(data.mrr).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Distribution */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-4">Revenue by Plan</h3>
        <div className="space-y-3">
          {data.planDistribution.map((p) => (
            <div key={p.name} className="group">
              <div className="flex items-center gap-3">
                <span className="text-sm w-24 truncate font-medium">{p.name}</span>
                <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full h-6 flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${Math.max((p.revenue / data.planDistribution[0].revenue) * 100, 8)}%` }}
                  >
                    <span className="text-[10px] text-white font-medium tabular-nums">{p.pct}%</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-500 w-14 text-right tabular-nums">{p.count} subs</span>
                <span className="text-xs font-semibold w-24 text-right tabular-nums">₦{Math.round(p.revenue).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscription States */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6">
        <h3 className="text-sm font-semibold mb-4">Subscription Lifecycle</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {data.stateDistribution.map((s) => (
            <div key={s.state} className="rounded-lg border border-zinc-100 dark:border-zinc-800 p-4 text-center relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 ${s.color}`} />
              <p className="text-2xl font-bold tabular-nums mt-1">{s.count}</p>
              <p className="text-[11px] text-zinc-400 capitalize mt-1 font-medium">{s.state.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
