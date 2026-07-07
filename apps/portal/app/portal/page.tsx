"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCards } from "@/components/portal/overview/kpi-cards";
import { SubscriptionDetails } from "@/components/portal/overview/subscription-details";
import { api, type GatewaySubscription, type GatewayPlan, type GatewayInvoice, type GatewayPaymentMethod, type PortalCustomer } from "@/lib/api-client";
import { resolveToken } from "@/lib/config";
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
      window.location.href = "/portal?token=eyJjdXN0b21lcklkIjoiNDA5MDQ2ZGViMTlkNDE5MjhmOTIiLCJtZXJjaGFudElkIjoibWVyX2tfVzBYc3BiTk4iLCJleHAiOjE3ODQwNTkxMDE3NDh9.50facbf4e142acadca3f4802033fac43786599d808f24d706b05ddef9cd544cd";
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
          const CASCADE_PRIORITY = ["va_fallback", "whatsapp_fallback", "retrying", "past_due"];
          const realSub = custSubs.find((s: any) => !plansData.find((p: any) => p.id === s.plan_id)?.name?.startsWith('[deleted]') && CASCADE_PRIORITY.includes(s.state))
            || custSubs.find((s: any) => !plansData.find((p: any) => p.id === s.plan_id)?.name?.startsWith('[deleted]'))
            || custSubs.find((s: any) => s.plan_id?.startsWith('plan_'))
            || custSubs[0];
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
      {["past_due", "va_fallback", "whatsapp_fallback", "retrying"].includes(status) && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 flex items-start gap-3">
          <AlertOctagon className="size-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-800">
              {status === "va_fallback" || status === "whatsapp_fallback"
                ? "Payment Required — Pay via Bank Transfer"
                : status === "retrying"
                ? "Payment Processing — Card Being Retried"
                : "Action Required: Subscription Past Due"}
            </h4>
            <p className="text-xs text-amber-700 mt-1">
              {status === "va_fallback" || status === "whatsapp_fallback"
                ? `Your card payment failed after multiple attempts. To keep your subscription active, transfer ₦${(planPrice / 100).toLocaleString()} to the virtual account below.`
                : status === "retrying"
                ? "We're retrying your card payment. No action needed — we'll notify you if retries are exhausted."
                : "Your payment failed. Update your card or pay via bank transfer."}
            </p>
            {(subscription as any)?.va_id && (
              <div className="mt-3 p-3 rounded-lg border-2 border-dashed border-amber-300 bg-white">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500 mb-1">Bank Transfer Details</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-zinc-400">Bank</span><p className="font-bold">Nombank MFB</p></div>
                  <div><span className="text-zinc-400">Account</span><p className="font-mono font-bold">{(subscription as any).va_id}</p></div>
                  <div><span className="text-zinc-400">Amount</span><p className="font-bold">₦{(planPrice / 100).toLocaleString()}</p></div>
                  <div><span className="text-zinc-400">Expires</span><p className="font-bold">{new Date((subscription as any).va_expires_at).toLocaleDateString('en-NG', {day:'numeric', month:'long'})}</p></div>
                </div>
              </div>
            )}
          </div>
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
