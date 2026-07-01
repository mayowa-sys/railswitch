"use client";

import { useState, useEffect } from "react";
import { Activity, TrendingDown, Zap, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/dashboard/overview/stats-card";
import { RevenueChart } from "@/components/dashboard/overview/revenue-chart";
import { FailedPaymentsTable } from "@/components/dashboard/overview/failed-payments-table";
import { WebhookFeed } from "@/components/dashboard/overview/webhook-feed";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

const STATS_COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: "text-emerald-600 dark:text-emerald-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/40", icon: "text-violet-600 dark:text-violet-400" },
  red: { bg: "bg-red-50 dark:bg-red-950/40", icon: "text-red-600 dark:text-red-400" },
};

export default function OverviewPage() {
  const { user } = useAuth();
  const [mrr, setMrr] = useState(0);
  const [arr, setArr] = useState(0);
  const [activeSubscribers, setActiveSubscribers] = useState(0);
  const [fetching, setFetching] = useState(true);

  const [subscriptionBars, setSubscriptionBars] = useState<{name: string; amount: number}[]>([]);

  useEffect(() => {
    const key = user?.apiKey ?? "";
    setFetching(true);
    api.subscriptions.list(key).then((subs) => {
      api.plans.list(key).then((plans) => {
        const planMap = new Map(plans.map((p) => [p.id, { name: p.name, amount: Number(p.amount) }]));
        const allSubs = subs.map((s) => {
          const plan = planMap.get(s.plan_id);
          return { name: plan?.name ?? "Unknown", amount: plan?.amount ?? 0, status: s.state };
        }) as { name: string; amount: number; status: string }[];
        const active = allSubs.filter((s) => s.status === "active");
        const m = active.reduce((sum, s) => sum + s.amount, 0);
        // Group active subs by plan name for the chart
        const grouped: Record<string, number> = {};
        for (const s of active) { grouped[s.name] = (grouped[s.name] || 0) + s.amount; }
        const bars = Object.entries(grouped).map(([name, amount]) => ({ name, amount }));
        setMrr(m);
        setArr(m * 12);
        setActiveSubscribers(active.length);
        setSubscriptionBars(bars);
        setFetching(false);
      }).catch((e) => { console.error("plans error:", e); setFetching(false); });
    }).catch((e) => { console.error("subs error:", e); setFetching(false); });
  }, [user?.apiKey]);

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard Overview" description="Monitor recurring revenue, recovery rates, and subscription health." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl border border-indigo-200/70 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 shadow-lg shadow-indigo-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Monthly Recurring Revenue</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white">
            {fetching ? <Loader2 className="size-6 animate-spin inline" /> : `₦${mrr.toLocaleString()}`}
          </h2>
          <p className="mt-1 text-sm text-indigo-200">ARR: <span className="font-bold text-white">₦{arr.toLocaleString()}</span></p>
          <div className="absolute -right-6 -top-6 size-32 rounded-full bg-white/5" />
          <div className="absolute -right-2 bottom-4 size-20 rounded-full bg-white/5" />
        </div>

        <StatsCard label="Active Subscribers" value={fetching ? "..." : activeSubscribers.toLocaleString()} change="+18.1%" trend="up" icon={Zap} colorConfig={STATS_COLOR_MAP.emerald} />
        <StatsCard label="Recovery Rate" value={recoveryRate} change="industry avg" trend="up" icon={Activity} colorConfig={STATS_COLOR_MAP.violet} subLabel="Cards recovered / cards failed" />
        <StatsCard label="Churn Rate" value={churnRate} change="" trend="down" icon={TrendingDown} colorConfig={STATS_COLOR_MAP.red} subLabel="Monthly subscriber churn" />
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">          <RevenueChart subscriptions={subscriptionBars} totalMrr={mrr} /></div>
        <div className="lg:col-span-3"><WebhookFeed /></div>
      </div>

      <FailedPaymentsTable />
    </div>
  );
}
