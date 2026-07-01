"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/portal/overview/kpi-cards";
import { SubscriptionDetails } from "@/components/portal/overview/subscription-details";
import { api, type GatewaySubscription, type GatewayPlan, type GatewayInvoice, type GatewayPaymentMethod } from "@/lib/api-client";
import { AlertOctagon, Loader2 } from "lucide-react";
import Link from "next/link";
import { PORTAL_API_KEY as API_KEY, PORTAL_CUSTOMER_ID, PORTAL_SUBSCRIPTION_ID } from "@/lib/config";

export default function OverviewPage() {
  const [subscription, setSubscription] = useState<GatewaySubscription | null>(null);
  const [plans, setPlans] = useState<GatewayPlan[]>([]);
  const [invoices, setInvoices] = useState<GatewayInvoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<GatewayPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.subscriptions.get(PORTAL_SUBSCRIPTION_ID, API_KEY),
      api.plans.list(API_KEY),
      api.invoices.list(API_KEY),
      api.paymentMethods.list(PORTAL_CUSTOMER_ID, API_KEY),
    ]).then(([sub, plansData, invData, pmData]) => {
      setSubscription(sub);
      setPlans(plansData);
      setInvoices(invData.filter((i) => i.subscription_id === PORTAL_SUBSCRIPTION_ID));
      setPaymentMethods(pmData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;
  }

  if (!subscription) {
    return <div className="py-12 text-center"><p className="text-sm text-zinc-500">No subscription found</p></div>;
  }

  const plan = plans.find((p) => p.id === subscription.plan_id);
  const planName = plan?.name ?? "Unknown";
  const planPrice = Number(plan?.amount ?? 0);
  const status = subscription.state;
  const nextBilling = new Date(subscription.current_period_end).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  const totalPaid = invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);
  const activeServices = status === "cancelled" ? 0 : 1;
  const defaultPM = paymentMethods.find((p) => p.is_default) || paymentMethods[0];
  const paymentMethodLabel = defaultPM ? `${defaultPM.brand || "Card"} •••• ${defaultPM.last4}` : "No payment method";

  const formatNaira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

  return (
    <div className="space-y-8">
      <PageHeader title="Portal Overview" description="Manage your subscription, payment methods, and billing history." />

      {status === "past_due" && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 flex items-start gap-3">
          <AlertOctagon className="size-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-red-800">Action Required: Subscription Past Due</h4>
            <p className="text-xs text-red-700 mt-1">Your payment failed. Update your card or pay via bank transfer to restore service.</p>
          </div>
        </div>
      )}

      <KpiCards totalSpentKobo={totalPaid} activeServices={activeServices} subscriptionStatus={status} defaultPaymentMethodName={paymentMethodLabel} />

      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionDetails subscriptionStatus={status} currentPlan={{ name: planName, price: planPrice, interval: plan?.interval === "annual" ? "annually" : "monthly", description: plan?.description ?? "" }} nextBillingDate={nextBilling} paymentMethodName={paymentMethodLabel} />

        <div className="rounded-xl border bg-white dark:bg-[#121215] p-6 shadow-sm">
          <h3 className="text-base font-semibold">Quick Actions</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Manage your subscription settings.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href="/portal/subscriptions" className="p-3.5 rounded-xl border hover:bg-zinc-50 transition-all"><p className="text-xs font-bold">Change Plan</p><p className="text-[10px] text-zinc-500 mt-0.5">Upgrade or downgrade</p></Link>
            <Link href="/portal/payment-methods" className="p-3.5 rounded-xl border hover:bg-zinc-50 transition-all"><p className="text-xs font-bold">Update Card</p><p className="text-[10px] text-zinc-500 mt-0.5">Manage payment methods</p></Link>
            <Link href="/portal/invoices" className="p-3.5 rounded-xl border hover:bg-zinc-50 transition-all"><p className="text-xs font-bold">Billing History</p><p className="text-[10px] text-zinc-500 mt-0.5">View invoices & receipts</p></Link>
            <Link href="/portal/settings" className="p-3.5 rounded-xl border hover:bg-zinc-50 transition-all"><p className="text-xs font-bold">Pause / Cancel</p><p className="text-[10px] text-zinc-500 mt-0.5">Manage subscription status</p></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
