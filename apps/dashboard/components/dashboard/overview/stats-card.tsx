import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down" | "neutral";
  icon: LucideIcon;
  colorConfig: { bg: string; icon: string };
  subLabel?: string;
}

export function StatsCard({
  label,
  value,
  change,
  trend,
  icon: Icon,
  colorConfig,
  subLabel,
}: StatsCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
      ? "text-red-500 dark:text-red-400"
      : "text-zinc-400";

  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        <div className={cn("size-8 rounded-lg flex items-center justify-center", colorConfig.bg, colorConfig.icon)}>
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
          {value}
        </h3>
        {subLabel && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{subLabel}</p>
        )}
        <div className={cn("mt-1.5 flex items-center gap-1.5 text-xs font-semibold", trendColor)}>
          <TrendIcon className="size-3.5" />
          <span>{change} from last month</span>
        </div>
      </div>
    </div>
  );
}
