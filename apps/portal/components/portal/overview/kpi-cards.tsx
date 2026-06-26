import { Card } from "@/components/ui/card";
import { formatNaira } from "@/lib/mock-data";
import { TrendingUp, Activity, Wallet } from "lucide-react";

interface KpiCardsProps {
  totalSpentKobo: number;
  activeServices: number;
  subscriptionStatus: string;
  defaultPaymentMethodName: string;
}

export function KpiCards({
  totalSpentKobo,
  activeServices,
  subscriptionStatus,
  defaultPaymentMethodName,
}: KpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* Total Spent */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Spent</p>
          <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {formatNaira(totalSpentKobo)}
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">Fully settled invoices</p>
        </div>
      </Card>

      {/* Active Services */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Services</p>
          <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Activity className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
            {activeServices} {activeServices === 1 ? "Service" : "Services"}
          </h3>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 font-semibold">
            {subscriptionStatus === "active" && "Billing is active"}
            {subscriptionStatus === "paused" && "Billing is paused"}
            {subscriptionStatus === "past_due" && "Grace period active"}
            {subscriptionStatus === "cancelled" && "No active plan"}
          </p>
        </div>
      </Card>

      {/* Payment Status */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Payment Status</p>
          <div className="size-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <Wallet className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
            {defaultPaymentMethodName}
          </h3>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
            {subscriptionStatus === "active" && "Auto-pay enabled"}
            {subscriptionStatus === "past_due" && "Card declined"}
            {subscriptionStatus === "paused" && "Billing paused"}
            {subscriptionStatus === "cancelled" && "Card disabled"}
          </p>
        </div>
      </Card>
    </div>
  );
}
