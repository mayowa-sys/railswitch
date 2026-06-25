"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadPortalState, formatNaira, PLANS } from "@/lib/mock-data";
import {
  CreditCard,
  Calendar,
  Wallet,
  ArrowRight,
  TrendingUp,
  Activity,
  AlertOctagon
} from "lucide-react";
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portal Overview"
        description="Manage your subscription, default payment cards, and review recent activity."
      />

      {/* Warning Banner if past_due */}
      {subscription.status === "past_due" && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/40 flex items-start gap-3">
          <AlertOctagon className="size-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0 animate-pulse" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-red-800 dark:text-red-400">Action Required: Subscription Past Due</h4>
            <p className="text-xs text-red-700 dark:text-red-500/80 leading-relaxed">
              Your automatic card renewal failed. To prevent service disruption, please configure bank transfers on Wema Bank Account 9012345678 or update your card immediately in the Payment Methods tab.
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Stat Card 1 */}
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Spent</p>
            <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {formatNaira(totalSpentKobo)}
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">Fully settled invoices</p>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Services</p>
            <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
              {activeServices} {activeServices === 1 ? "Service" : "Services"}
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">
              {subscription.status === "active" && "Billing is active"}
              {subscription.status === "paused" && "Billing is paused"}
              {subscription.status === "past_due" && "Grace period active"}
              {subscription.status === "cancelled" && "No active plan"}
            </p>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Payment Status</p>
            <div className="size-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
              <Wallet className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                {activePaymentMethod.type === "card" ? `${activePaymentMethod.brand} •••• ${activePaymentMethod.last4}` : `${activePaymentMethod.bankName} •••• ${activePaymentMethod.last4}`}
              </span>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
              {subscription.status === "active" && "Auto-pay enabled"}
              {subscription.status === "past_due" && "Card declined"}
              {subscription.status === "paused" && "Billing paused"}
              {subscription.status === "cancelled" && "Card disabled"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Overview Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        
        {/* Subscription Plan Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Subscription details</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage plan and billing tier.</p>
              </div>
              <StatusBadge status={subscription.status} />
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <CreditCard className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Current Plan</p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {currentPlan.name} Plan — {formatNaira(currentPlan.price)}/mo
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <Calendar className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {subscription.status === "cancelled" ? "Access Terminated Date" : "Next Billing Date"}
                  </p>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {subscription.nextBillingDate}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-850 flex justify-end">
            <Link
              href="/portal/subscriptions"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Configure Subscription <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

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
