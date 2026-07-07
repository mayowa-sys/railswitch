"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/portal/overview/kpi-cards";
import { SubscriptionDetails } from "@/components/portal/overview/subscription-details";
import { api, type GatewaySubscription, type GatewayPlan, type GatewayInvoice, type GatewayPaymentMethod, type PortalCustomer } from "@/lib/api-client";
import { resolveToken, PORTAL_API_URL, PORTAL_API_KEY } from "@/lib/config";
import { AlertOctagon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OverviewPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const [subscription, setSubscription] = useState<GatewaySubscription | null>(null);
  const [plans, setPlans] = useState<GatewayPlan[]>([]);
  const [invoices, setInvoices] = useState<GatewayInvoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<GatewayPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { 
      // Auto-generate demo portal link for Jumoke Bakare
      fetch(`${PORTAL_API_URL}/v1/portal/customers/409046deb19d41928f92/link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${PORTAL_API_KEY}` },
      }).then(res => res.json()).then(data => {
        if (data.data?.portal_url) {
          window.location.href = data.data.portal_url;
        } else {
          setError('No portal token provided');
          setLoading(false);
        }
      }).catch(() => { setError('No portal token provided'); setLoading(false); });
      return;
    }
    
    resolveToken(token).then(async (data) => {
      if (!data) { setError('Invalid or expired portal link'); setLoading(false); return; }
      setCustomer(data.customer as unknown as PortalCustomer);
      
      try {
        const [subs, plansData, invData] = await Promise.all([
          api.subscriptions.list(),
          api.plans.list(),
          api.invoices.list(),
        ]);
        
        setPlans(plansData);
        const custSubs = subs.filter(s => s.customer_id === (data.customer as any).id);
        const custInvoices = invData.filter((i: any) => custSubs.some((s: any) => s.id === i.subscription_id));
        setInvoices(custInvoices);
        
        if (custSubs.length > 0) {
          const realSub = custSubs.find((s: any) => !plansData.find((p: any) => p.id === s.plan_id)?.name?.startsWith('[deleted]')) || custSubs.find((s: any) => s.plan_id?.startsWith('plan_')) || custSubs[0];
          setSubscription(realSub);
        }
        
        try {
          const pms = await api.paymentMethods.list((data.customer as any).id);
          setPaymentMethods(pms);
        } catch {}
        
        setLoading(false);
      } catch { setLoading(false); }
    }).catch(() => { setError('Failed to load portal'); setLoading(false); });
  }, [token]);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;
  if (error) return <div className="py-12 text-center"><p className="text-sm text-zinc-500">{error}</p></div>;

  const plan = plans.find(p => subscription && p.id === subscription.plan_id);
  const planName = plan?.name || 'Unknown';
  const planPrice = Number(plan?.amount || 0);
  const status = subscription?.state || 'active';
  const nextBilling = subscription ? new Date(subscription.current_period_end).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0);
  const defaultPM = paymentMethods.find(p => p.is_default) || paymentMethods[0];
  const pmLabel = defaultPM ? `${defaultPM.brand || 'Card'} •••• ${defaultPM.last4}` : 'No payment method';
  

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome, ${customer?.name || 'Customer'}`} description="Manage your subscription, payment methods, and billing history." />
      {status === "past_due" && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 flex items-start gap-3">
          <AlertOctagon className="size-5 text-red-600 mt-0.5 shrink-0" />
          <div><h4 className="text-sm font-bold text-red-800">Action Required: Subscription Past Due</h4><p className="text-xs text-red-700 mt-1">Your payment failed. Update your card or pay via bank transfer.</p></div>
        </div>
      )}
      <KpiCards totalSpentKobo={totalPaid} activeServices={status === 'cancelled' ? 0 : 1} subscriptionStatus={status} defaultPaymentMethodName={pmLabel} />
      <div className="grid gap-6 md:grid-cols-2">
        <SubscriptionDetails subscriptionStatus={status} currentPlan={{ id: plan?.id || "", name: planName, price: planPrice, interval: plan?.interval === 'annual' ? 'annually' : 'monthly', description: plan?.description || '' }} nextBillingDate={nextBilling} paymentMethodName={pmLabel} />
        <div className="rounded-xl border bg-white dark:bg-[#121215] p-6 shadow-sm">
          <h3 className="text-base font-semibold">Quick Actions</h3>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Link href={`/portal/subscriptions?token=${token}`} className="p-3.5 rounded-xl border hover:bg-zinc-50"><p className="text-xs font-bold">Change Plan</p></Link>
            <Link href={`/portal/payment-methods?token=${token}`} className="p-3.5 rounded-xl border hover:bg-zinc-50"><p className="text-xs font-bold">Update Card</p></Link>
            <Link href={`/portal/invoices?token=${token}`} className="p-3.5 rounded-xl border hover:bg-zinc-50"><p className="text-xs font-bold">Billing History</p></Link>
            <Link href={`/portal/settings?token=${token}`} className="p-3.5 rounded-xl border hover:bg-zinc-50"><p className="text-xs font-bold">Pause / Cancel</p></Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>}>
      <OverviewPageContent />
    </Suspense>
  );
}
