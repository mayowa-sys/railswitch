"use client";

import Link from "next/link";
import {
  getCustomerById,
  getSubscriptionsByCustomer,
  PLANS,
  formatNaira,
  type Customer,
  type Subscription,
} from "@/lib/mock-data";
import { CustomerStatsRow } from "@/components/dashboard/customers/customer-stats-row";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ChevronLeft, CreditCard, Landmark, Check } from "lucide-react";

const subColumns: Column<Subscription>[] = [
  {
    key: "plan",
    header: "Plan",
    cell: (row) => {
      const plan = PLANS.find((p) => p.id === row.planId);
      return (
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          {plan?.name ?? "—"}
        </span>
      );
    },
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: "amount",
    header: "Amount",
    cell: (row) => (
      <span className="text-xs font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
        {formatNaira(row.amount)}
      </span>
    ),
  },
  {
    key: "started",
    header: "Started",
    cell: (row) => (
      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {new Date(row.startedAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </span>
    ),
  },
  {
    key: "nextBilling",
    header: "Next billing",
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
    key: "payments",
    header: "Payments",
    cell: (row) => (
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {row.billingHistory.filter((b) => b.status === "paid").length} paid
      </span>
    ),
  },
];

interface CustomerDetailProps {
  customerId: string;
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const customer = getCustomerById(customerId);
  const subscriptions = getSubscriptionsByCustomer(customerId);

  if (!customer) return null;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard/customers"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        <ChevronLeft className="size-3.5" />
        Back to customers
      </Link>

      {/* Customer profile header */}
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-gradient-to-tr from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center text-xl font-extrabold text-indigo-700 dark:text-indigo-300 shrink-0">
          {customer.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {customer.name}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {customer.email} · {customer.phone}
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
            Customer since{" "}
            {new Date(customer.createdAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <CustomerStatsRow customer={customer} />

      {/* Subscriptions table */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Subscriptions
        </h2>
        <DataTable
          columns={subColumns}
          data={subscriptions}
          emptyTitle="No subscriptions"
          emptyDescription="This customer doesn't have any subscriptions yet."
        />
      </section>

      {/* Payment methods */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Payment methods
        </h2>
        <div className="space-y-2">
          {customer.paymentMethods.map((method, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-4"
            >
              <div className="size-9 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400 shrink-0">
                {method.type === "card" ? (
                  <CreditCard className="size-4" />
                ) : (
                  <Landmark className="size-4" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {method.type === "card" ? method.brand : method.bank} ••••{" "}
                  {method.last4}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                  {method.type.replace("_", " ")}
                </p>
              </div>
              {method.isDefault && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3" /> Default
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
