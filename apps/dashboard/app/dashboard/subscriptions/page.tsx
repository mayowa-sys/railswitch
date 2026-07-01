"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionsTable } from "@/components/dashboard/subscriptions/subscriptions-table-live";
import { useAuth } from "@/lib/auth-context";
import { api, isMockMode } from "@/lib/api-client";
import type { GatewaySubscription, GatewayPlan, GatewayCustomer } from "@/lib/api-client";

interface LiveSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "past_due" | "cancelled" | "paused" | "trialing";
  state: string;
  amount: number;
  nextBillingDate: string;
  cascadeHistory: { step: string; status: "success" | "failed" | "pending" }[];
}

interface LivePlan { id: string; name: string; amount: number; }
interface LiveCustomer { id: string; name: string; email: string; }

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<LiveSubscription[]>([]);
  const [plans, setPlans] = useState<LivePlan[]>([]);
  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isMockMode() || !user?.apiKey) { setLoading(false); return; }
    (async () => {
      try {
        const [rawSubs, rawPlans, rawCusts] = await Promise.all([
          api.subscriptions.list(user.apiKey),
          api.plans.list(user.apiKey),
          api.customers.list(user.apiKey),
        ]);
        const planMap = new Map(rawPlans.map((p) => [p.id, p]));
        const custMap = new Map(rawCusts.map((c) => [c.id, c]));
        setSubs(rawSubs.map((s) => ({
          id: s.id,
          customerId: s.customer_id,
          planId: s.plan_id,
          status: (s.state as "active" | "past_due" | "cancelled" | "paused" | "trialing") ?? "active",
          state: s.state ?? "active",
          amount: planMap.get(s.plan_id)?.amount ?? 0,
          nextBillingDate: s.current_period_end ?? s.next_billing_at ?? new Date().toISOString(),
          cascadeHistory: [],
        })));
        setPlans(rawPlans);
        setCustomers(rawCusts.map((c) => ({ id: c.id, name: c.name, email: c.email })));
      } catch {} finally { setLoading(false); }
    })();
  }, [user]);

  const activeCount = subs.filter((s) => s.status === "active").length;

  if (loading && subs.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Subscriptions" description="Loading..." badge={null} />
        <div className="flex items-center justify-center py-20 text-zinc-400">Loading subscriptions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="View and manage all customer subscriptions."
        badge={
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
            {activeCount} active
          </span>
        }
      />
      <SubscriptionsTable subscriptions={subs} plans={plans} customers={customers} loading={loading} />
    </div>
  );
}
