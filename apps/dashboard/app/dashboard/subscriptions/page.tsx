"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";
import { SubscriptionsTable } from "@/components/dashboard/subscriptions/subscriptions-table-live";
import { api } from "@/lib/api-client";

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
    const key = user?.apiKey ?? "";
    Promise.all([
      api.subscriptions.list(key),
      api.plans.list(key),
      api.customers.list(key),
    ]).then(([rawSubs, rawPlans, rawCusts]) => {
      const planMap = new Map(rawPlans.map((p) => [p.id, p]));
      setPlans(rawPlans.map((p) => ({ id: p.id, name: p.name, amount: Number(p.amount) })));
      setCustomers(rawCusts.map((c) => ({ id: c.id, name: c.name, email: c.email })));
      setSubs(rawSubs.map((s) => ({
        id: s.id,
        customerId: s.customer_id,
        planId: s.plan_id,
        status: (s.state as LiveSubscription["status"]) ?? "active",
        state: s.state,
        amount: Number(planMap.get(s.plan_id)?.amount ?? 0),
        nextBillingDate: s.current_period_end ?? new Date().toISOString(),
        cascadeHistory: [],
      })) as LiveSubscription[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  const activeCount = subs.filter((s) => s.status === "active").length;

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
