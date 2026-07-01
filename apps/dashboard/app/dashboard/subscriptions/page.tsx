"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionsTable } from "@/components/dashboard/subscriptions/subscriptions-table";
import { useApiData } from "@/lib/use-api-data";
import { api, type GatewaySubscription, type GatewayPlan, type GatewayCustomer } from "@/lib/api-client";
import {
  SUBSCRIPTIONS as MOCK_SUBS,
  CUSTOMERS as MOCK_CUSTOMERS,
  PLANS as MOCK_PLANS,
  type Subscription,
  type Plan,
  type Customer,
} from "@/lib/mock-data";

function mapGatewaySubscription(sub: GatewaySubscription, plans: Plan[], customers: Customer[]): Subscription {
  return {
    id: sub.id,
    planId: sub.plan_id,
    customerId: sub.customer_id,
    status: sub.status as Subscription["status"],
    startedAt: sub.created_at,
    nextBillingDate: sub.current_period_end,
    amount: plans.find((p) => p.id === sub.plan_id)?.price ?? 0,
    cascadeHistory: [],
    billingHistory: [],
  };
}

function mapGatewayPlan(p: GatewayPlan): Plan {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: p.amount,
    interval: (p.interval === "year" ? "annually" : p.interval === "month" ? "monthly" : "quarterly") as Plan["interval"],
    trialDays: 0,
    status: p.is_active ? "active" : "archived",
    subscriberCount: 0,
    createdAt: p.created_at,
  };
}

function mapGatewayCustomer(c: GatewayCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone ?? "",
    totalRevenue: 0,
    activeSubscriptions: 0,
    paymentMethods: [],
    createdAt: c.created_at,
  };
}

export default function SubscriptionsPage() {
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

  const { data: rawCustomers, isLoading: custLoading } = useApiData({
    fetcher: (key) => api.customers.list(key),
    mockData: [] as GatewayCustomer[],
    apiKey,
  });

  const isLoading = subsLoading || plansLoading || custLoading;

  const subscriptions = useMemo(() => {
    const plans = rawPlans.length > 0 ? rawPlans.map(mapGatewayPlan) : MOCK_PLANS;
    const customers = rawCustomers.length > 0 ? rawCustomers.map(mapGatewayCustomer) : MOCK_CUSTOMERS;
    const subs = rawSubs.length > 0
      ? rawSubs.map((s) => mapGatewaySubscription(s, plans, customers))
      : MOCK_SUBS;
    return { subs, plans, customers };
  }, [rawSubs, rawPlans, rawCustomers]);

  const activeCount = subscriptions.subs.filter((s) => s.status === "active").length;

  const planOptions = subscriptions.plans.map((p) => ({ value: p.id, label: p.name }));

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

      <SubscriptionsTable
        subscriptions={subscriptions.subs}
        plans={subscriptions.plans}
        customers={subscriptions.customers}
        planOptions={planOptions}
        loading={isLoading}
      />
    </div>
  );
}
