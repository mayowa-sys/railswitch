"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/portal/overview/kpi-cards";
import { SubscriptionDetails } from "@/components/portal/overview/subscription-details";
import { loadPortalState, PLANS } from "@/lib/mock-data";
import { AlertOctagon, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function OverviewPage() {
  const [state, setState] = useState(loadPortalState());

  useEffect(() => {
    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscription = state.subscription;
  const currentPlan = PLANS.find((p) => p.id === subscription.planId) || PLANS[0];
  const activePaymentMethod = state.paymentMethods.find((pm) => pm.id === subscription.paymentMethodId) || state.paymentMethods[0];

  // Calculate stats
  const totalSpentKobo = state.invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const activeServices = subscription.status === "cancelled" ? 0 : 1;

  const defaultPaymentMethodName = activePaymentMethod.type === "card"
    ? `${activePaymentMethod.brand} •••• ${activePaymentMethod.last4}`
    : `${activePaymentMethod.bankName} Account •••• ${activePaymentMethod.last4}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portal Overview"
        description="Manage your subscription, default payment cards, and review recent activity."
      />

      {/* Warning Banner if past_due */}
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

      {/* KPI Cards Row */}
      <KpiCards
        totalSpentKobo={totalSpentKobo}
        activeServices={activeServices}
        subscriptionStatus={subscription.status}
        defaultPaymentMethodName={defaultPaymentMethodName}
      />

      {/* Main Overview Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Subscription Plan details */}
        <SubscriptionDetails
          subscriptionStatus={subscription.status}
          currentPlan={currentPlan}
          nextBillingDate={subscription.nextBillingDate}
          paymentMethodName={defaultPaymentMethodName}
        />

        {/* Quick Self Service Portal Links */}
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
