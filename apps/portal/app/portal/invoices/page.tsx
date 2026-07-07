"use client";

import { useState, useEffect, Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { InvoicesTable } from "@/components/portal/invoices/invoices-table";
import { api, type GatewayInvoice, type GatewaySubscription } from "@/lib/api-client";
import { Search, Loader2 } from "lucide-react";

function InvoicesContent() {
  const [invoices, setInvoices] = useState<GatewayInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    Promise.all([api.invoices.list(), api.subscriptions.list()]).then(([allInvs, subs]) => {
      const subIds = new Set(subs.map((s: GatewaySubscription) => s.id));
      setInvoices(allInvs.filter((inv: GatewayInvoice) => subIds.has(inv.subscription_id)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (inv.status || "").toLowerCase().includes(q) || (inv.description || "").toLowerCase().includes(q) || inv.id.toLowerCase().includes(q);
  });

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;

  const mapped = filtered.map((inv) => ({
    id: inv.id,
    planName: inv.description ?? "Subscription",
    amount: Number(inv.amount),
    status: inv.status as "paid" | "failed" | "pending",
    date: new Date(inv.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
    method: "Gateway",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Invoice History" description="View past charges and download receipts." />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
        <input type="text" placeholder="Filter invoices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-9 pl-9 pr-4 rounded-lg bg-zinc-100 border border-transparent focus:border-zinc-200 focus:bg-white text-sm transition-all outline-none" />
      </div>
      <InvoicesTable invoices={mapped} onDownloadReceipt={(inv) => {
        const text = `RailSwitch Receipt\nInvoice: ${inv.id}\nDate: ${inv.date}\nAmount: N${(inv.amount / 100).toLocaleString()}\nStatus: ${inv.status.toUpperCase()}`;
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${inv.id}_receipt.txt`; a.click();
      }} />
    </div>
  );
}

export default function InvoicesPage() {
  return <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>}><InvoicesContent /></Suspense>;
}
