"use client";

import { useMemo } from "react";
import { Activity, TrendingDown, Zap } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/dashboard/overview/stats-card";
import { RevenueChart } from "@/components/dashboard/overview/revenue-chart";
import { FailedPaymentsTable } from "@/components/dashboard/overview/failed-payments-table";
import { WebhookFeed } from "@/components/dashboard/overview/webhook-feed";
import { formatNaira, OVERVIEW_STATS } from "@/lib/mock-data";
import { useApiData } from "@/lib/use-api-data";
import { api, type GatewaySubscription, type GatewayPlan } from "@/lib/api-client";

const STATS_COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    icon: "text-violet-600 dark:text-violet-400",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/40",
    icon: "text-red-600 dark:text-red-400",
  },
};

export default function OverviewPage() {
  const apiKey = "";

  const { data: rawSubs, isLoading: subsLoading } = useApiData({
    fetcher: (key) => api.subscriptions.list(key),
    mockData: [] as GatewaySubscription[],
    apiKey,
  });

  const { data: rawPlans, isLoading: plansLoading } = useApiData({
    fetcher: (key) => api.plans.list(key),
    mockData: [] as GatewayPlan[],
    apiKey,
  });

  const isLoading = subsLoading || plansLoading;

  const computedStats = useMemo(() => {
    if (rawSubs.length === 0) return null;

    const plansMap = new Map(rawPlans.map((p) => [p.id, p.amount]));
    const activeSubs = rawSubs.filter((s) => s.status === "active");
    const mrr = activeSubs.reduce((sum, s) => sum + (plansMap.get(s.plan_id) ?? 0), 0);

    return {
      mrr,
      activeSubscribers: activeSubs.length,
    };
  }, [rawSubs, rawPlans]);

  const { mrr, arr, activeSubscribers, churnRate, recoveryRate } = computedStats
    ? {
        mrr: computedStats.mrr,
        arr: computedStats.mrr * 12,
        activeSubscribers: computedStats.activeSubscribers,
        churnRate: OVERVIEW_STATS.churnRate,
        recoveryRate: OVERVIEW_STATS.recoveryRate,
      }
    : OVERVIEW_STATS;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard Overview"
        description="Monitor recurring revenue, recovery rates, and subscription health."
      />

      {/* KPI row — MRR hero + 3 stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* MRR hero card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-xl border border-indigo-200/70 dark:border-indigo-800/50 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 shadow-lg shadow-indigo-500/20">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
            Monthly Recurring Revenue
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white">
            {isLoading ? (
              <span className="opacity-50">—</span>
            ) : (
              formatNaira(mrr)
            )}
          </h2>
          <p className="mt-1 text-sm text-indigo-200">
            ARR:{" "}
            <span className="font-bold text-white">{formatNaira(arr)}</span>
          </p>
          {/* decorative blobs */}
          <div className="absolute -right-6 -top-6 size-32 rounded-full bg-white/5" />
          <div className="absolute -right-2 bottom-4 size-20 rounded-full bg-white/5" />
        </div>

        <StatsCard
          label="Active Subscribers"
          value={isLoading ? "—" : activeSubscribers.toLocaleString()}
          change="+18.1%"
          trend="up"
          icon={Zap}
          colorConfig={STATS_COLOR_MAP.emerald}
        />
        <StatsCard
          label="Recovery Rate"
          value={`${recoveryRate}%`}
          change="+5.2%"
          trend="up"
          icon={Activity}
          colorConfig={STATS_COLOR_MAP.violet}
          subLabel="Cards recovered / cards failed"
        />
        <StatsCard
          label="Churn Rate"
          value={`${churnRate}%`}
          change="-0.4%"
          trend="down"
          icon={TrendingDown}
          colorConfig={STATS_COLOR_MAP.red}
          subLabel="Monthly subscriber churn"
        />
      </div>

      {/* Chart + Webhooks side by side */}
      <div className="grid gap-6 lg:grid-cols-7">
        <div className="lg:col-span-4">
          <RevenueChart />
        </div>
        <div className="lg:col-span-3">
          <WebhookFeed />
        </div>
      </div>

      {/* Failed payment queue */}
      <FailedPaymentsTable />
    </div>
  );
}
