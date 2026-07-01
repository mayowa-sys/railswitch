"use client";

import { useState, useMemo, useEffect } from "react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { CreditCard, RefreshCcw, Landmark, Hash, MessageCircle } from "lucide-react";

interface LiveSubscription {
  id: string;
  customerId: string;
  planId: string;
  status: "active" | "past_due" | "cancelled" | "paused" | "trialing";
  state: string;
  amount: number;
  nextBillingDate: string;
  cascadeHistory: { step: string; status: "success" | "failed" | "pending" }[];
}
interface LivePlan { id: string; name: string; amount: number; }
interface LiveCustomer { id: string; name: string; email: string; }

interface Props {
  subscriptions: LiveSubscription[];
  plans: LivePlan[];
  customers: LiveCustomer[];
  loading?: boolean;
}

const CASCADE_ICONS: Record<string, React.ReactNode> = {
  card: <CreditCard className="size-3" />,
  retry: <RefreshCcw className="size-3" />,
  virtual_account: <Landmark className="size-3" />,
  ussd: <Hash className="size-3" />,
  whatsapp: <MessageCircle className="size-3" />,
};

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelled" },
  { value: "paused", label: "Paused" },
  { value: "trialing", label: "Trialing" },
];

export function SubscriptionsTable({ subscriptions, plans, customers, loading }: Props) {
  const planOptions = plans.map((p) => ({ value: p.id, label: p.name }));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [selected, setSelected] = useState<LiveSubscription | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const formatNaira = (n: number) => `₦${n.toLocaleString()}`;

  const filtered = useMemo(() => {
    return subscriptions.filter((sub) => {
      const customer = customers.find((c) => c.id === sub.customerId);
      const matchSearch =
        !search ||
        customer?.name.toLowerCase().includes(search.toLowerCase()) ||
        customer?.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || sub.status === statusFilter;
      const matchPlan = !planFilter || sub.planId === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [subscriptions, customers, search, statusFilter, planFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pagedData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => { setPage(0); }, [search, statusFilter, planFilter]);

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (page > 3) pages.push("...");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 4) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  }, [totalPages, page]);

  const hasFilters = !!search || !!statusFilter || !!planFilter;

  const columns: Column<LiveSubscription>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (row) => {
        const customer = customers.find((c) => c.id === row.customerId);
        return (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
              {customer?.name.split(" ").map((n) => n[0]).join("") ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{customer?.name}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{customer?.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "plan",
      header: "Plan",
      cell: (row) => {
        const plan = plans.find((p) => p.id === row.planId);
        return <span className="text-xs text-zinc-700 dark:text-zinc-300">{plan?.name ?? "—"}</span>;
      },
    },
    {
      key: "status", header: "Status", cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "mrr",
      header: "MRR",
      cell: (row) => <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatNaira(row.amount)}</span>,
    },
    {
      key: "nextBilling",
      header: "Next Billing",
      cell: (row) => (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {row.status === "cancelled" ? "—" : new Date(row.nextBillingDate).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
    },
    {
      key: "cascade",
      header: "Cascade",
      cell: (row) => {
        if (row.cascadeHistory.length === 0) return <span className="text-[11px] text-zinc-300 dark:text-zinc-600">—</span>;
        return (
          <div className="flex items-center gap-0.5">
            {row.cascadeHistory.map((step, i) => (
              <span key={i} title={step.step} className={`size-5 rounded flex items-center justify-center ${step.status === "success" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : step.status === "pending" ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30" : "text-red-500 bg-red-50 dark:bg-red-950/30"}`}>
                {CASCADE_ICONS[step.step]}
              </span>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search customer name or email…"
        filters={[
          { key: "status", placeholder: "All statuses", options: STATUS_OPTIONS, value: statusFilter, onChange: setStatusFilter },
          { key: "plan", placeholder: "All plans", options: planOptions, value: planFilter, onChange: setPlanFilter },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setSearch(""); setStatusFilter(""); setPlanFilter(""); }}
      />
      <div className="mt-4">
        <DataTable columns={columns}         data={pagedData} rowKey={(row) => row.id} onRowClick={setSelected}
          emptyTitle="No subscriptions found" emptyDescription="Try a different search term or clear your filters." />
        {totalPages > 1 && (
          <div className="flex flex-col items-center gap-2 mt-4">
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                className="h-7 px-2.5 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Prev
              </button>
              {pageNumbers.map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="w-7 text-center text-xs text-zinc-400">…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p as number)}
                    className={`h-7 w-7 rounded text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                    {(p as number) + 1}
                  </button>
                )
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                className="h-7 px-2.5 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Next
              </button>
            </div>
            <p className="text-[11px] text-zinc-400">
              {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
