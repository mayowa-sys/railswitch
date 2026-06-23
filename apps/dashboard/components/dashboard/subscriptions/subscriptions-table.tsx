"use client";

import { useState, useMemo } from "react";
import {
  SUBSCRIPTIONS,
  CUSTOMERS,
  PLANS,
  formatNaira,
  type Subscription,
} from "@/lib/mock-data";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { SubscriptionDetailDrawer } from "@/components/dashboard/subscriptions/subscription-detail-drawer";
import { CreditCard, RefreshCcw, Landmark, Hash, MessageCircle } from "lucide-react";

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

const PLAN_OPTIONS = PLANS.map((p) => ({ value: p.id, label: p.name }));

export function SubscriptionsTable() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [selected, setSelected] = useState<Subscription | null>(null);

  const filtered = useMemo(() => {
    return SUBSCRIPTIONS.filter((sub) => {
      const customer = CUSTOMERS.find((c) => c.id === sub.customerId);
      const matchSearch =
        !search ||
        customer?.name.toLowerCase().includes(search.toLowerCase()) ||
        customer?.email.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || sub.status === statusFilter;
      const matchPlan = !planFilter || sub.planId === planFilter;
      return matchSearch && matchStatus && matchPlan;
    });
  }, [search, statusFilter, planFilter]);

  const hasFilters = !!search || !!statusFilter || !!planFilter;

  const columns: Column<Subscription>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (row) => {
        const customer = CUSTOMERS.find((c) => c.id === row.customerId);
        return (
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
              {customer?.name.split(" ").map((n) => n[0]).join("") ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {customer?.name}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                {customer?.email}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "plan",
      header: "Plan",
      cell: (row) => {
        const plan = PLANS.find((p) => p.id === row.planId);
        return (
          <span className="text-xs text-zinc-700 dark:text-zinc-300">{plan?.name ?? "—"}</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "mrr",
      header: "MRR",
      cell: (row) => (
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
          {formatNaira(row.amount)}
        </span>
      ),
    },
    {
      key: "nextBilling",
      header: "Next Billing",
      cell: (row) => (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {row.status === "cancelled"
            ? "—"
            : new Date(row.nextBillingDate).toLocaleDateString("en-NG", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
        </span>
      ),
    },
    {
      key: "cascade",
      header: "Cascade",
      cell: (row) => {
        if (row.cascadeHistory.length === 0) {
          return <span className="text-[11px] text-zinc-300 dark:text-zinc-600">—</span>;
        }
        return (
          <div className="flex items-center gap-0.5">
            {row.cascadeHistory.map((step, i) => (
              <span
                key={i}
                title={step.step}
                className={`size-5 rounded flex items-center justify-center ${
                  step.status === "success"
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                    : step.status === "pending"
                    ? "text-amber-500 bg-amber-50 dark:bg-amber-950/30"
                    : "text-red-500 bg-red-50 dark:bg-red-950/30"
                }`}
              >
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
      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search customer name or email…"
        filters={[
          {
            key: "status",
            placeholder: "All statuses",
            options: STATUS_OPTIONS,
            value: statusFilter,
            onChange: setStatusFilter,
          },
          {
            key: "plan",
            placeholder: "All plans",
            options: PLAN_OPTIONS,
            value: planFilter,
            onChange: setPlanFilter,
          },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setSearch(""); setStatusFilter(""); setPlanFilter(""); }}
      />

      <div className="mt-4">
        <DataTable
          columns={columns}
          data={filtered}
          onRowClick={setSelected}
          emptyTitle="No subscriptions found"
          emptyDescription="Try a different search term or clear your filters."
        />
      </div>

      <SubscriptionDetailDrawer
        subscription={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
