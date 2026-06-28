"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CUSTOMERS, formatNaira, type Customer } from "@/lib/mock-data";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { CreditCard, Landmark, ExternalLink } from "lucide-react";

function PaymentMethodIcons({ methods }: { methods: Customer["paymentMethods"] }) {
  return (
    <div className="flex items-center gap-1">
      {methods.map((m, i) => (
        <span
          key={i}
          title={
            m.type === "card"
              ? `${m.brand} •••• ${m.last4}`
              : `${m.bank} •••• ${m.last4}`
          }
          className="size-5 rounded flex items-center justify-center bg-zinc-100 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400"
        >
          {m.type === "card" ? (
            <CreditCard className="size-3" />
          ) : (
            <Landmark className="size-3" />
          )}
        </span>
      ))}
    </div>
  );
}

const COLUMNS: Column<Customer>[] = [
  {
    key: "customer",
    header: "Customer",
    cell: (row) => (
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
          {row.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {row.name}
          </p>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
            {row.email}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: "activeSubs",
    header: "Active subs",
    cell: (row) => (
      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
        {row.activeSubscriptions}
      </span>
    ),
  },
  {
    key: "revenue",
    header: "Total revenue",
    cell: (row) => (
      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
        {formatNaira(row.totalRevenue)}
      </span>
    ),
  },
  {
    key: "paymentMethods",
    header: "Payment methods",
    cell: (row) => <PaymentMethodIcons methods={row.paymentMethods} />,
  },
  {
    key: "since",
    header: "Customer since",
    cell: (row) => (
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {new Date(row.createdAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    key: "action",
    header: "",
    headerClassName: "w-10",
    cell: () => (
      <ExternalLink className="size-3.5 text-zinc-300 dark:text-zinc-600 group-hover:text-indigo-500 transition-colors" />
    ),
  },
];

export function CustomersTable() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      CUSTOMERS.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        );
      }),
    [search]
  );

  return (
    <>
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or email…"
        hasActiveFilters={!!search}
        onClearAll={() => setSearch("")}
      />

      <div className="mt-4">
        <DataTable
          columns={COLUMNS}
          data={filtered}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(`/dashboard/customers/${row.id}`)}
          rowClassName="group"
          emptyTitle="No customers found"
          emptyDescription="Try a different search term."
        />
      </div>
    </>
  );
}
