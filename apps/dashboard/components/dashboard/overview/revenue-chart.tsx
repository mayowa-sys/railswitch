"use client";

import { cn } from "@/lib/utils";

interface SubBar {
  name: string;
  amount: number;
  color: string;
}

interface Props {
  subscriptions: SubBar[];
  totalMrr: number;
}

const COLORS = [
  "bg-indigo-600",
  "bg-violet-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-rose-500",
];

export function RevenueChart({ subscriptions, totalMrr }: Props) {
  const hasData = subscriptions.length > 0;
  const maxVal = hasData ? Math.max(...subscriptions.map((s) => s.amount), totalMrr) : 1;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 flex flex-col">
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Active Subscriptions</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          {hasData ? `${subscriptions.length} active subscriptions · ₦${totalMrr.toLocaleString()} MRR` : "No active subscriptions"}
        </p>
      </div>

      <div className="flex items-center gap-4 mt-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {subscriptions.slice(0, 5).map((s, i) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", COLORS[i % COLORS.length])} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="h-48 mt-5 flex items-end gap-3 justify-center px-1">
        {hasData ? subscriptions.map((sub, idx) => {
          const pct = (sub.amount / maxVal) * 100;
          return (
            <div key={sub.name} className="flex-1 flex flex-col items-center gap-2 max-w-[120px]">
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums">
                ₦{(sub.amount / 1000).toFixed(0)}k
              </span>
              <div className="w-full flex-1 flex flex-col justify-end rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800/40" style={{ minHeight: "140px" }}>
                <div
                  className={cn("w-full rounded-t-lg transition-all duration-700", COLORS[idx % COLORS.length])}
                  style={{
                    height: `${pct}%`,
                    minHeight: "8px",
                  }}
                />
              </div>
              <span className="text-[10px] font-medium text-zinc-400 text-center leading-tight">
                {sub.name}
              </span>
            </div>
          );
        }) : (
          <div className="flex items-center justify-center h-full w-full text-zinc-400 text-sm">Loading subscription data...</div>
        )}
      </div>
    </div>
  );
}
