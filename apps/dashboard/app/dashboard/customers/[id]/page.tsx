"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, CreditCard, Landmark } from "lucide-react";
import { api, isMockMode, type GatewayPlan, type GatewayInvoice } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { formatNaira } from "@/lib/mock-data";

interface SubInfo {
  id: string;
  planName: string;
  status: string;
  amount: number;
  startedAt: string;
  nextBilling: string;
  invoiceCount: number;
}

interface PMInfo {
  id: string;
  type: string;
  last4: string;
  brand: string;
  isDefault: boolean;
}

export default function CustomerDetailPage() {
  const { user } = useAuth();
  const API_KEY = user?.apiKey ?? "";
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [customer, setCustomer] = useState<{ name: string; email: string; createdAt: string } | null>(null);
  const [subs, setSubs] = useState<SubInfo[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PMInfo[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [status, setStatus] = useState<"loading" | "found" | "not-found">("loading");

  useEffect(() => {
    if (isMockMode()) {
      setStatus("not-found");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [c, allSubs, allPlans, allInvoices] = await Promise.all([
          api.customers.get(id, API_KEY),
          api.subscriptions.list(API_KEY),
          api.plans.list(API_KEY),
          api.invoices.list(API_KEY),
        ]);
        if (cancelled) return;
        if (!c) { setStatus("not-found"); return; }

        const planMap = new Map(allPlans.map((p) => [p.id, p]));
        const custSubs = allSubs.filter((s) => s.customer_id === id);

        // Fetch payment methods
        let pms: PMInfo[] = [];
        try {
          const pmRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/v1/payment-methods`, {
            headers: { Authorization: `Bearer ${API_KEY}` }
          });
          const pmJson = await pmRes.json();
          pms = (pmJson.data || []).filter((pm: any) => pm.customer_id === id).map((pm: any) => ({
            id: pm.id, type: pm.type, last4: pm.last4 || "****", brand: pm.brand, isDefault: pm.is_default
          }));
        } catch {}

        const subsWithInfo: SubInfo[] = custSubs.map((s) => {
          const subInvoices = allInvoices.filter((inv) => inv.subscription_id === s.id);
          const paidCount = subInvoices.filter((inv) => inv.status === "paid").length;
          return {
            id: s.id,
            planName: planMap.get(s.plan_id)?.name ?? "Unknown",
            status: s.state,
            amount: Number(planMap.get(s.plan_id)?.amount ?? 0),
            startedAt: s.current_period_start,
            nextBilling: s.current_period_end,
            invoiceCount: paidCount,
          };
        });

        const revenue = allInvoices
          .filter((inv) => custSubs.some((s) => s.id === inv.subscription_id) && inv.status === "paid")
          .reduce((sum, inv) => sum + Number(inv.amount), 0);

        setCustomer({ name: c.name ?? c.email.split("@")[0], email: c.email, createdAt: c.created_at });
        setSubs(subsWithInfo);
        setPaymentMethods(pms);
        setTotalRevenue(revenue);
        setStatus("found");
      } catch {
        if (!cancelled) setStatus("not-found");
      }
    })();
    return () => { cancelled = true; };
  }, [id, API_KEY]);

  if (status === "not-found") {
    return (
      <div className="space-y-8">
        <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900">
          <ChevronLeft className="size-3.5" /> Back to customers
        </Link>
        <div className="rounded-xl border p-12 text-center"><p className="text-sm font-semibold">Customer not found</p></div>
      </div>
    );
  }

  if (status === "loading" || !customer) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-8">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900">
        <ChevronLeft className="size-3.5" /> Back to customers
      </Link>

      {/* Customer header */}
      <div className="rounded-xl border bg-white dark:bg-[#121215] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
                {customer.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <h2 className="text-lg font-bold">{customer.name}</h2>
                <p className="text-sm text-zinc-500">{customer.email}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums">{formatNaira(totalRevenue)}</p>
            <p className="text-xs text-zinc-500">Lifetime revenue</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-6 text-xs text-zinc-500">
          <span>Customer since {new Date(customer.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span>{paymentMethods.length} payment {paymentMethods.length === 1 ? "method" : "methods"}</span>
          <span>{subs.length} subscription{subs.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Payment Methods */}
      {paymentMethods.length > 0 && (
        <div className="rounded-xl border bg-white dark:bg-[#121215] p-5 shadow-sm">
          <h3 className="text-sm font-semibold mb-3">Payment Methods</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center gap-3 p-3 rounded-lg border bg-zinc-50 dark:bg-zinc-900/30">
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
                  <CreditCard className="size-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold capitalize">{pm.brand || pm.type} •••• {pm.last4}</p>
                  {pm.isDefault && <p className="text-[10px] text-indigo-600 font-medium">Default</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscriptions */}
      <div className="rounded-xl border bg-white dark:bg-[#121215] p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-3">Subscriptions</h3>
        {subs.length === 0 ? (
          <p className="text-sm text-zinc-400">No subscriptions</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-zinc-500">
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Started</th>
                  <th className="pb-2 font-medium">Next billing</th>
                  <th className="pb-2 font-medium">Payments</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.planName}</td>
                    <td className="py-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : s.status === 'cancelled' ? 'bg-red-50 text-red-700' : s.status === 'paused' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>{s.status}</span></td>
                    <td className="py-2 font-medium tabular-nums">{formatNaira(s.amount)}</td>
                    <td className="py-2 text-xs text-zinc-500">{new Date(s.startedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-2 text-xs text-zinc-500">{new Date(s.nextBilling).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-2 text-xs">{s.invoiceCount} paid</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
