"use client";

interface SubBar {
  name: string;
  amount: number;
}

interface Props {
  subscriptions: SubBar[];
  totalMrr: number;
}

const COLORS = [
  "from-indigo-600 to-indigo-500",
  "from-violet-500 to-violet-400",
  "from-purple-500 to-purple-400",
  "from-pink-500 to-pink-400",
  "from-rose-500 to-rose-400",
];

export function RevenueChart({ subscriptions, totalMrr }: Props) {
  const hasData = subscriptions.length > 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Active Subscriptions</h3>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
        {hasData ? `${subscriptions.length} plans · ₦${totalMrr.toLocaleString()} MRR` : "No active subscriptions"}
      </p>

      <div className="mt-5 space-y-3">
        {hasData ? subscriptions.map((sub, i) => {
          const pct = totalMrr > 0 ? (sub.amount / totalMrr) * 100 : 0;
          return (
            <div key={sub.name} className="group">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{sub.name}</span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                  ₦{sub.amount.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${COLORS[i % COLORS.length]} transition-all duration-1000 ease-out`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-400 mt-0.5">{pct.toFixed(0)}% of MRR</p>
            </div>
          );
        }) : (
          <div className="flex items-center justify-center py-8 text-zinc-400 text-sm">Loading...</div>
        )}
      </div>
    </div>
  );
}
