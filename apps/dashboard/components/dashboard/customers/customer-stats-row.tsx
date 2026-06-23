import { formatNaira, type Customer } from "@/lib/mock-data";
import { DollarSign, Zap, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomerStatsRowProps {
  customer: Customer;
}

const STATS = (customer: Customer) => [
  {
    label: "Total Revenue",
    value: formatNaira(customer.totalRevenue),
    icon: DollarSign,
    colorConfig: {
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      icon: "text-indigo-600 dark:text-indigo-400",
    },
  },
  {
    label: "Active Subscriptions",
    value: String(customer.activeSubscriptions),
    icon: Zap,
    colorConfig: {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      icon: "text-emerald-600 dark:text-emerald-400",
    },
  },
  {
    label: "Payment Methods",
    value: String(customer.paymentMethods.length),
    icon: CreditCard,
    colorConfig: {
      bg: "bg-violet-50 dark:bg-violet-950/40",
      icon: "text-violet-600 dark:text-violet-400",
    },
  },
];

export function CustomerStatsRow({ customer }: CustomerStatsRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {STATS(customer).map(({ label, value, icon: Icon, colorConfig }) => (
        <div
          key={label}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {label}
            </p>
            <div
              className={cn(
                "size-8 rounded-lg flex items-center justify-center",
                colorConfig.bg,
                colorConfig.icon
              )}
            >
              <Icon className="size-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
