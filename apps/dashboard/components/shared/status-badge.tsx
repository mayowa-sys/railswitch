import { cn } from "@/lib/utils";
import type { PlanStatus, SubscriptionStatus } from "@/lib/mock-data";

type StatusValue = SubscriptionStatus | PlanStatus | "success" | "failed" | "pending" | "paid" | "refunded";

const STATUS_CONFIG: Record<StatusValue, { label: string; className: string }> = {
  active:           { label: "Active",        className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  past_due:         { label: "Past Due",      className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  cancelled:        { label: "Cancelled",     className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
  paused:           { label: "Paused",        className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  trialing:         { label: "Trialing",      className: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800/60" },
  archived:         { label: "Archived",      className: "bg-zinc-100 text-zinc-500 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-500 dark:border-zinc-700" },
  success:          { label: "Success",       className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  failed:           { label: "Failed",        className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  pending:          { label: "Pending",       className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60" },
  paid:             { label: "Paid",          className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  refunded:         { label: "Refunded",      className: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60" },
};

interface StatusBadgeProps {
  status: StatusValue;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-zinc-100 text-zinc-600 border-zinc-200" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tracking-wide",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
