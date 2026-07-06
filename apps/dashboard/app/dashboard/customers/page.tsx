"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { useAuth } from "@/lib/auth-context";
import { api, type GatewayPlan, type GatewayInvoice } from "@/lib/api-client";
import { formatNaira } from "@/lib/mock-data";
import { isTestCustomer, isTestPlan } from "@/lib/utils";
import { CreditCard, Landmark, ExternalLink } from "lucide-react";

interface LiveCustomer {
  id: string;
  name: string;
  email: string;
  planName: string;
  totalRevenue: number;
  monthsSubscribed: number;
  paymentMethods: { type: string; last4: string; brand?: string }[];
  createdAt: string;
}

function PaymentMethodIcons({ methods }: { methods: LiveCustomer["paymentMethods"] }) {
  if (methods.length === 0) return <span className="text-[11px] text-zinc-400">—</span>;
  return (
    <div className="flex items-center gap-1">
      {methods.map((m, i) => (
        <span key={i} title={`${m.brand || "card"} •••• ${m.last4}`}
          className="size-5 rounded flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500">
          <CreditCard className="size-3" />
        </span>
      ))}
    </div>
  );
}

const COLUMNS: Column<LiveCustomer>[] = [
  {
    key: "customer", header: "Customer",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 flex items-center justify-center text-[11px] font-bold text-indigo-700 shrink-0">
          {row.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{row.name}</p>
          <p className="text-[10px] text-zinc-500 truncate">{row.email}</p>
        </div>
      </div>
    ),
  },
  { key: "plan", header: "Plan", cell: (row) => <span className="text-xs">{row.planName}</span> },
  { key: "revenue", header: "Lifetime revenue", cell: (row) => <span className="text-xs font-bold tabular-nums">{formatNaira(row.totalRevenue)}</span> },
  { key: "months", header: "Since", cell: (row) => <span className="text-xs">{row.monthsSubscribed} {row.monthsSubscribed === 1 ? "month" : "months"}</span> },
  { key: "paymentMethods", header: "Card", cell: (row) => <PaymentMethodIcons methods={row.paymentMethods} /> },
  { key: "since", header: "Joined", cell: (row) => <span className="text-[11px] text-zinc-500">{new Date(row.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span> },
  { key: "action", header: "", headerClassName: "w-10", cell: () => <ExternalLink className="size-3.5 text-zinc-300 group-hover:text-indigo-500 transition-colors" /> },
];

export default function CustomersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    const key = user?.apiKey ?? "";
    if (!key) { setLoading(false); return; }
    Promise.all([
      api.customers.list(key),
      api.subscriptions.list(key),
      api.plans.list(key),
      api.invoices.list(key),
    ]).then(async ([rawCustomers, rawSubs, rawPlans, rawInvoices]) => {
      const planMap = new Map(rawPlans.filter(p => !isTestPlan(p.name)).map((p) => [p.id, p]));
      const subsByCust: Record<string, typeof rawSubs> = {};
      for (const s of rawSubs) {
        if (!subsByCust[s.customer_id]) subsByCust[s.customer_id] = [];
        subsByCust[s.customer_id].push(s);
      }
      const invoicesByCust: Record<string, typeof rawInvoices> = {};
      for (const inv of rawInvoices) {
        const sub = rawSubs.find((s) => s.id === inv.subscription_id);
        if (sub) {
          const cid = sub.customer_id;
          if (!invoicesByCust[cid]) invoicesByCust[cid] = [];
          invoicesByCust[cid].push(inv);
        }
      }

      // Fetch payment methods for all customers
      let allPaymentMethods: any[] = [];
      try {
        const pmRes = await fetch(          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/v1/payment-methods`, {
          headers: { Authorization: `Bearer ${key}` }
        });
        const pmJson = await pmRes.json();
        allPaymentMethods = pmJson.data || [];
      } catch {}

      const pmByCust: Record<string, any[]> = {};
      for (const pm of allPaymentMethods) {
        if (!pmByCust[pm.customer_id]) pmByCust[pm.customer_id] = [];
        pmByCust[pm.customer_id].push(pm);
      }

      const realCustomers = rawCustomers.filter((c) => !isTestCustomer(c.email, c.name));

      const mapped: LiveCustomer[] = realCustomers.map((c) => {
        const custSubs = subsByCust[c.id] || [];
        const sub = custSubs[0];
        const plan = sub ? planMap.get(sub.plan_id) : null;
        const custInvoices = invoicesByCust[c.id] || [];
        const totalRevenue = custInvoices
          .filter((inv) => inv.status === "paid")
          .reduce((sum, inv) => sum + Math.round(Number(inv.amount)), 0);
        
        const pms = pmByCust[c.id] || [];
        const monthsSubscribed = custInvoices.filter((inv) => inv.status === "paid").length;

        return {
          id: c.id,
          name: c.name ?? c.email.split("@")[0],
          email: c.email,
          planName: plan?.name ?? (custSubs.length > 0 ? "Unknown" : "No plan"),
          totalRevenue,
          monthsSubscribed,
          paymentMethods: pms.map((pm) => ({ type: pm.type, last4: pm.last4 || "****", brand: pm.brand })),
          createdAt: c.created_at,
        };
      });

      setCustomers(mapped);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [customers, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) { for (let i = 0; i < totalPages; i++) pages.push(i); }
    else {
      pages.push(0);
      if (page > 3) pages.push("...");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 4) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  }, [totalPages, page]);

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description={`${customers.length} customers in total`} />
      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" /></div>
      ) : (
        <>
          <SearchFilterBar
            searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(0); }}
            searchPlaceholder="Search by name or email…"
            hasActiveFilters={!!search}
            onClearAll={() => { setSearch(""); setPage(0); }}
          />
          <div className="mt-4">
            <DataTable columns={COLUMNS} data={paged} rowKey={(row) => row.id} onRowClick={(row) => router.push(`/dashboard/customers/${row.id}`)} rowClassName="group" emptyTitle="No customers found" emptyDescription="Try adjusting your search." />
            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-2 mt-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-7 px-2.5 rounded text-xs font-medium border disabled:opacity-30 hover:bg-zinc-100 transition-colors">Prev</button>
                  {pageNumbers.map((p, i) => p === "..." ? <span key={`e-${i}`} className="w-7 text-center text-xs text-zinc-400">…</span> : <button key={p} onClick={() => setPage(p as number)} className={`h-7 w-7 rounded text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'border hover:bg-zinc-100'}`}>{(p as number) + 1}</button>)}
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="h-7 px-2.5 rounded text-xs font-medium border disabled:opacity-30 hover:bg-zinc-100 transition-colors">Next</button>
                </div>
                <p className="text-[11px] text-zinc-400">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
