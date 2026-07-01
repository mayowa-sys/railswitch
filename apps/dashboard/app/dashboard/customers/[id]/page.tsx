"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2 } from "lucide-react";
import { api, isMockMode } from "@/lib/api-client";
import {
  getCustomerById,
  getSubscriptionsByCustomer,
  type Customer as MockCustomer,
  type Subscription as MockSubscription,
  type SubscriptionStatus,
} from "@/lib/mock-data";
import { CustomerDetail } from "@/components/dashboard/customers/customer-detail";

const API_KEY = user?.apiKey ?? "";

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [customer, setCustomer] = useState<MockCustomer | null>(null);
  const [subscriptions, setSubscriptions] = useState<MockSubscription[]>([]);
  const [status, setStatus] = useState<"loading" | "found" | "not-found">(
    "loading",
  );

  useEffect(() => {
    if (isMockMode()) {
      const mockCustomer = getCustomerById(id);
      if (!mockCustomer) {
        setStatus("not-found");
        return;
      }
      setCustomer(mockCustomer);
      setSubscriptions(getSubscriptionsByCustomer(id));
      setStatus("found");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [c, subs, plans] = await Promise.all([
          api.customers.get(id, API_KEY),
          api.subscriptions.list(API_KEY),
          api.plans.list(API_KEY),
        ]);
        if (cancelled) return;
        const planMap = new Map(plans.map((p) => [p.id, p]));
        const customerSubs = subs.filter((s) => s.customer_id === id);
        setSubscriptions(
          customerSubs.map((s) => ({
            id: s.id,
            planId: s.plan_id,
            customerId: s.customer_id,
            status: (s.state as SubscriptionStatus) ?? "active",
            startedAt: s.current_period_start,
            nextBillingDate: s.current_period_end,
            amount: planMap.get(s.plan_id)?.amount ?? 0,
            cascadeHistory: [],
            billingHistory: [],
          })),
        );
        setCustomer({
          id: c.id,
          name: c.name ?? c.email.split("@")[0],
          email: c.email,
          phone: c.phone ?? "",
          totalRevenue: 0,
          activeSubscriptions: customerSubs.filter(
            (s) => s.status === "active",
          ).length,
          paymentMethods: [],
          createdAt: c.created_at,
        });
        setStatus("found");
      } catch {
        if (!cancelled) setStatus("not-found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "not-found") {
    return (
      <div className="space-y-8">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Back to customers
        </Link>
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-12 text-center shadow-sm">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Customer not found
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            This customer does not exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading" || !customer) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <CustomerDetail
      customerId={id}
      customer={customer}
      subscriptions={subscriptions}
    />
  );
}
