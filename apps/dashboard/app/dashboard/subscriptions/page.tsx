"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuth } from "@/lib/auth-context";
import { SubscriptionsTable } from "@/components/dashboard/subscriptions/subscriptions-table-live";
import { api } from "@/lib/api-client";
import { isTestCustomer, isTestPlan } from "@/lib/utils";

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
    if (!key) { setLoading(false); return; }
    Promise.all([
      api.subscriptions.list(key),
      api.plans.list(key),
      api.customers.list(key),
    ]).then(([rawSubs, rawPlans, rawCusts]) => {
      const realPlans = rawPlans.filter((p: any) => !isTestPlan(p.name));
      const realCustomers = rawCusts.filter((c: any) => !isTestCustomer(c.email, c.name));
      const custSet = new Set(realCustomers.map((c: any) => c.id));
      const planMap = new Map(realPlans.map((p: any) => [p.id, p]));
      const planIdSet = new Set(realPlans.map((p: any) => p.id));

      setPlans(realPlans.map((p: any) => ({ id: p.id, name: p.name, amount: Number(p.amount) })));
      setCustomers(realCustomers.map((c: any) => ({ id: c.id, name: c.name, email: c.email })));
      const STATUS_MAP: Record<string, string> = {
        active: "active", charging: "active", past_due: "past_due", cancelled: "cancelled",
        paused: "paused", trialing: "trialing", retrying: "retrying",
        va_fallback: "va_fallback", whatsapp_fallback: "whatsapp_fallback", expired: "cancelled",
      };
      const realSubs = rawSubs.filter((s: any) => custSet.has(s.customer_id) && planIdSet.has(s.plan_id));
      setSubs(realSubs.map((s) => ({
        id: s.id,
        customerId: s.customer_id,
        planId: s.plan_id,
        status: (STATUS_MAP[s.state] || s.state) as LiveSubscription["status"],
        state: s.state,
        amount: Number(planMap.get(s.plan_id)?.amount ?? 0) / 100,
        nextBillingDate: s.current_period_end ?? new Date().toISOString(),
        cascadeHistory: (s as any).cascade_history ?? [],
      })) as LiveSubscription[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  const activeCount = subs.filter((s) => s.state === "active").length;

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
