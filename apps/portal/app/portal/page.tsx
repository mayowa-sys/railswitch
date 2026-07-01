"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/portal/overview/kpi-cards";
import { SubscriptionDetails } from "@/components/portal/overview/subscription-details";
import { loadPortalState, PLANS, getServerPortalState, formatNaira } from "@/lib/mock-data";
import { isMockMode, api, type GatewaySubscription, type GatewayPlan, type GatewayInvoice } from "@/lib/api-client";
import { useApiData } from "@/lib/use-api-data";
import { AlertOctagon } from "lucide-react";
import Link from "next/link";

const API_KEY = "";

export default function OverviewPage() {
  const [state, setState] = useState(() => getServerPortalState());
  const mock = isMockMode();

  const { data: rawSubs, isLoading: subsLoading } = useApiData({
    fetcher: (key) => api.subscriptions.list(key),
    mockData: [] as GatewaySubscription[],
    apiKey: API_KEY,
  });

  const { data: rawPlans, isLoading: plansLoading } = useApiData({
    fetcher: (key) => api.plans.list(key),
    mockData: [] as GatewayPlan[],
    apiKey: API_KEY,
  });

  const { data: rawInvoices, isLoading: invLoading } = useApiData({
    fetcher: (key) => api.invoices.list(key),
    mockData: [] as GatewayInvoice[],
    apiKey: API_KEY,
  });

  const loading = !mock && (subsLoading || plansLoading || invLoading);

  useEffect(() => {
    if (!mock) return;
    setState(loadPortalState());
    const handleStorageChange = () => { setState(loadPortalState()); };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [mock]);

  const realSubscription = useMemo(() => {
    if (mock || rawSubs.length === 0) return null;
    const sub = rawSubs[0];
    const plan = rawPlans.find((p) => p.id === sub.plan_id);
    return {
      id: sub.id,
      planId: sub.plan_id,
      status: sub.status as string,
      nextBillingDate: new Date(sub.current_period_end).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
      paymentMethodId: "",
      planName: plan?.name ?? "Unknown",
      planDescription: plan?.description ?? "",
      planPrice: plan?.amount ?? 0,
      planInterval: plan?.interval ?? "month",
    };
  }, [mock, rawSubs, rawPlans]);

  const realInvoices = useMemo(() => {
    if (mock || rawInvoices.length === 0) return [];
    return rawInvoices.map((inv) => ({
      id: inv.id,
      planName: inv.description ?? "Subscription",
      amount: inv.amount,
      status: inv.status as "paid" | "failed" | "pending",
      date: new Date(inv.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
      method: "Gateway",
    }));
  }, [mock, rawInvoices]);

  const subscription = realSubscription || state.subscription;
  const currentPlan = realSubscription
    ? { id: subscription.planId, name: realSubscription.planName, description: realSubscription.planDescription, price: realSubscription.planPrice, interval: realSubscription.planInterval as "monthly" | "annually" }
    : PLANS.find((p) => p.id === subscription.planId) || PLANS[0];

  const activePaymentMethod = (state?.paymentMethods || getServerPortalState().paymentMethods).find((pm) => pm.id === subscription.paymentMethodId) || (state?.paymentMethods || getServerPortalState().paymentMethods)[0];

  const totalSpentKobo = mock
    ? state.invoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.amount, 0)
    : realInvoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + inv.amount, 0);

  const activeServices = subscription.status === "cancelled" ? 0 : 1;

  const defaultPaymentMethodName = activePaymentMethod
    ? (activePaymentMethod.type === "card"
      ? `${activePaymentMethod.brand || "Card"} •••• ${activePaymentMethod.last4}`
      : `${activePaymentMethod.bankName || "Bank"} Account •••• ${activePaymentMethod.last4}`)
    : "No payment method";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portal Overview"
        description="Manage your subscription, default payment cards, and review recent activity."
      />

      {subscription.status === "past_due" && (
        <div className="p-4 rounded-xl border border-red-205 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/40 flex items-start gap-3">
          <AlertOctagon className="size-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-800 dark:text-red-400 font-heading">Action Required: Subscription Past Due</h4>
            <p className="text-xs text-red-700 dark:text-red-500/80 leading-relaxed font-semibold">
              Your automatic card renewal failed. To prevent service disruption, please configure bank transfers on Wema Bank Account 9012345678 or update your card immediately in the Payment Methods tab.
            </p>
          </div>
        </div>
      )}

      <KpiCards
        totalSpentKobo={totalSpentKobo}
        activeServices={activeServices}
        subscriptionStatus={subscription.status}
        defaultPaymentMethodName={defaultPaymentMethodName}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionDetails
          subscriptionStatus={subscription.status}
          currentPlan={currentPlan}
          nextBillingDate={subscription.nextBillingDate}
          paymentMethodName={defaultPaymentMethodName}
        />

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Quick Actions</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Quick shortcuts for self-service flows.</p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/portal/subscriptions"
                className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-left transition-all"
              >
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Change Plan</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Upgrade or downgrade your current tier</p>
              </Link>

              <Link
                href="/portal/payment-methods"
                className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-left transition-all"
              >
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Update Card</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Manage tokenized card payment rails</p>
              </Link>

              <Link
                href="/portal/invoices"
                className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-left transition-all"
              >
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Billing Statements</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Download receipts and view logs</p>
              </Link>

              <Link
                href="/portal/settings"
                className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 text-left transition-all"
              >
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Pause / Cancel</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">Temporarily pause or cancel billing</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
