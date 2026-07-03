"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatNaira, type Customer } from "@/lib/mock-data";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { CreditCard, Landmark, ExternalLink } from "lucide-react";

function PaymentMethodIcons({ methods }: { methods: Customer["paymentMethods"] }) {
  return (
    <div className="flex items-center gap-1">
      {methods.map((m, i) => (
        <span key={i} title={m.type === "card" ? `${m.brand} •••• ${m.last4}` : `${m.bank} •••• ${m.last4}`}
          className="size-5 rounded flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400">
          {m.type === "card" ? <CreditCard className="size-3" /> : <Landmark className="size-3" />}
        </span>
      ))}
    </div>
  );
}

const COLUMNS: Column<Customer>[] = [
  {
    key: "customer", header: "Customer",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
          {row.name.split(" ").map((n) => n[0]).join("")}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{row.name}</p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{row.email}</p>
        </div>
      </div>
    ),
  },
  { key: "activeSubs", header: "Active subs", cell: (row) => <span className="text-xs font-semibold">{row.activeSubscriptions}</span> },
  { key: "revenue", header: "Total revenue", cell: (row) => <span className="text-xs font-bold tabular-nums">{formatNaira(row.totalRevenue)}</span> },
  { key: "paymentMethods", header: "Payment methods", cell: (row) => <PaymentMethodIcons methods={row.paymentMethods} /> },
  { key: "since", header: "Customer since", cell: (row) => <span className="text-[11px] text-zinc-500">{new Date(row.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span> },
  { key: "action", header: "", headerClassName: "w-10", cell: () => <ExternalLink className="size-3.5 text-zinc-300 group-hover:text-indigo-500 transition-colors" /> },
];

export function CustomersTable({ externalCustomers }: { externalCustomers?: Customer[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const customers = externalCustomers ?? [];
  
  const filtered = useMemo(() => {
    if (!search) return customers;
    const q = search.toLowerCase();
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [customers, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
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

  return (
    <>
      <SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by name or email…" hasActiveFilters={!!search} onClearAll={() => setSearch("")} />
      <div className="mt-4">
        <DataTable columns={COLUMNS} data={paged} rowKey={(row) => row.id} onRowClick={(row) => router.push(`/dashboard/customers/${row.id}`)} rowClassName="group" emptyTitle="No customers found" emptyDescription="Try a different search term." />
        {totalPages > 1 && (
          <div className="flex flex-col items-center gap-2 mt-4">
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-7 px-2.5 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Prev</button>
              {pageNumbers.map((p, i) =>
                p === "..." ? <span key={`e-${i}`} className="w-7 text-center text-xs text-zinc-400">…</span> :
                <button key={p} onClick={() => setPage(p as number)} className={`h-7 w-7 rounded text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{(p as number) + 1}</button>
              )}
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="h-7 px-2.5 rounded text-xs font-medium border border-zinc-200 dark:border-zinc-700 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Next</button>
            </div>
            <p className="text-[11px] text-zinc-400">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</p>
          </div>
        )}
      </div>
    </>
  );
}
