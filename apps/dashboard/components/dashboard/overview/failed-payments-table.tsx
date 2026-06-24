"use client";

import {
  FAILED_PAYMENTS,
  CUSTOMERS,
  formatNaira,
  type FailedPayment,
} from "@/lib/mock-data";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  CreditCard,
  RefreshCcw,
  Landmark,
  Hash,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const CASCADE_ICON: Record<string, React.ReactNode> = {
  card: <CreditCard className="size-3.5" />,
  retry: <RefreshCcw className="size-3.5" />,
  virtual_account: <Landmark className="size-3.5" />,
  ussd: <Hash className="size-3.5" />,
  whatsapp: <MessageCircle className="size-3.5" />,
};

const CASCADE_LABEL: Record<string, string> = {
  card: "Card",
  retry: "Smart Retry",
  virtual_account: "Virtual Account",
  ussd: "USSD",
  whatsapp: "WhatsApp",
};

const COLUMNS: Column<FailedPayment>[] = [
  {
    key: "customer",
    header: "Customer",
    cell: (row) => {
      const customer = CUSTOMERS.find((c) => c.id === row.customerId);
      return (
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-full bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-[10px] font-bold text-zinc-600 dark:text-zinc-400 shrink-0">
            {customer?.name
              .split(" ")
              .map((n) => n[0])
              .join("") ?? "?"}
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              {customer?.name ?? "Unknown"}
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {customer?.email ?? "—"}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    key: "amount",
    header: "Amount",
    className: "font-semibold tabular-nums",
    cell: (row) => (
      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
        {formatNaira(row.amount)}
      </span>
    ),
  },
  {
    key: "reason",
    header: "Reason",
    cell: (row) => (
      <span className="text-xs text-zinc-600 dark:text-zinc-300">{row.reason}</span>
    ),
  },
  {
    key: "cascade",
    header: "Cascade Step",
    cell: (row) => (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded-full">
        {CASCADE_ICON[row.cascadeStepReached]}
        {CASCADE_LABEL[row.cascadeStepReached]}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: () => <StatusBadge status="past_due" />,
  },
  {
    key: "time",
    header: "Time",
    cell: (row) => (
      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
        {new Date(row.attemptedAt).toLocaleDateString("en-NG", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    ),
  },
];

export function FailedPaymentsTable() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Failed Payment Queue
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {FAILED_PAYMENTS.length} payments in recovery
          </p>
        </div>
        <Link
          href="/dashboard/subscriptions"
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
        >
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      <DataTable
        columns={COLUMNS}
        data={FAILED_PAYMENTS.slice(0, 5)}
        emptyTitle="No failed payments"
        emptyDescription="All subscriptions are billing successfully."
      />
    </div>
  );
}
