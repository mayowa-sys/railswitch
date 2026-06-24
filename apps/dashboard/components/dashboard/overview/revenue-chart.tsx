"use client";

import { useState } from "react";
import { formatNaira, REVENUE_BARS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const PERIODS = ["7 Days", "30 Days", "90 Days"] as const;
type Period = (typeof PERIODS)[number];

export function RevenueChart() {
  const [activePeriod, setActivePeriod] = useState<Period>("7 Days");
  const maxVal = Math.max(...REVENUE_BARS.map((b) => b.collected + b.recovered));

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 flex flex-col">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Revenue Overview
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Weekly collected vs. recovered breakdown
          </p>
        </div>
        <div className="inline-flex items-center gap-1 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 p-1 text-xs font-medium">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={cn(
                "rounded-md px-2.5 py-1 transition-all",
                activePeriod === p
                  ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm font-semibold"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-indigo-600" /> Collected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-violet-400" /> Recovered
        </span>
      </div>

      {/* Bars */}
      <div className="h-52 mt-5 flex items-end gap-2 justify-between px-1">
        {REVENUE_BARS.map(({ day, collected, recovered }, idx) => {
          const total = collected + recovered;
          const totalPct = (total / maxVal) * 100;
          const collectedPct = (collected / total) * 100;
          const recoveredPct = (recovered / total) * 100;
          return (
            <div
              key={day}
              className="flex-1 flex flex-col items-center gap-1.5 group/bar"
            >
              <div
                className="w-full flex flex-col justify-end rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800/40"
                style={{ height: "180px" }}
                title={`${day}: ${formatNaira(total)}`}
              >
                {/* Stacked bar wrapper — grows from bottom */}
                <div
                  className="w-full flex flex-col-reverse overflow-hidden"
                  style={{
                    height: `${totalPct}%`,
                    animation: `rs-fade-up 0.8s cubic-bezier(0.22,1,0.36,1) ${idx * 60}ms backwards`,
                  }}
                >
                  {/* Collected segment (bottom) */}
                  <div
                    style={{ height: `${collectedPct}%` }}
                    className="w-full bg-indigo-600 group-hover/bar:brightness-110 transition-all duration-300 shrink-0"
                  />
                  {/* Recovered segment (top) */}
                  <div
                    style={{ height: `${recoveredPct}%` }}
                    className="w-full bg-violet-400 shrink-0"
                  />
                </div>
              </div>
              <span className="text-[10px] font-medium text-zinc-400 group-hover/bar:text-zinc-700 dark:group-hover/bar:text-zinc-200 transition-colors">
                {day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
