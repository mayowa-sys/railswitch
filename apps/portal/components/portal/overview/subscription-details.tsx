import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatNaira, type Plan } from "@/lib/mock-data";
import { CreditCard, Calendar, ArrowRight } from "lucide-react";
import Link from "next/link";

interface SubscriptionDetailsProps {
  subscriptionStatus: string;
  currentPlan: Plan;
  nextBillingDate: string;
  paymentMethodName: string;
}

export function SubscriptionDetails({
  subscriptionStatus,
  currentPlan,
  nextBillingDate,
  paymentMethodName,
}: SubscriptionDetailsProps) {
  return (
    <Card className="p-6 flex flex-col justify-between shadow-sm">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Subscription details</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Manage plan and billing tier.</p>
          </div>
          <StatusBadge status={subscriptionStatus as any} />
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
              <CreditCard className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Current Plan</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {currentPlan.name} Plan — {formatNaira(currentPlan.price)}/mo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
              <Calendar className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                {subscriptionStatus === "cancelled" ? "Access Terminated Date" : "Next Billing Date"}
              </p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {nextBillingDate}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-zinc-850 flex justify-end">
        <Link
          href="/portal/subscriptions"
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Configure Subscription <ArrowRight className="size-3" />
        </Link>
      </div>
    </Card>
  );
}
