import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatNaira, type Plan } from "@/lib/mock-data";
import { Pause, Play, XCircle, HelpCircle, Loader2 } from "lucide-react";

interface StatusManagementProps {
  subscriptionStatus: string;
  currentPlan: Plan;
  nextBillingDate: string;
  actionLoading: "pause" | "resume" | "cancel" | null;
  onPause: () => void;
  onResume: () => void;
  onCancelClick: () => void;
}

export function StatusManagement({
  subscriptionStatus,
  currentPlan,
  nextBillingDate,
  actionLoading,
  onPause,
  onResume,
  onCancelClick,
}: StatusManagementProps) {
  return (
    <Card className="p-6 shadow-sm space-y-6">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-850">
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Subscription Status Management</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Control plan renewals, pausing, and service closures.</p>
          </div>
          <StatusBadge status={subscriptionStatus as any} />
        </div>
      </div>

      {/* Status description */}
      <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 font-medium">
        {subscriptionStatus === "active" && (
          <p>
            Your subscription is currently <strong className="text-zinc-900 dark:text-zinc-100">Active</strong> on the <strong className="text-indigo-600 dark:text-indigo-400">{currentPlan.name}</strong> tier. You will be billed automatically next on <strong className="text-zinc-900 dark:text-zinc-100">{nextBillingDate}</strong>.
          </p>
        )}
        {subscriptionStatus === "past_due" && (
          <p className="text-red-600 dark:text-red-400 font-bold">
            Your subscription is currently in Dunning / Past Due state because automatic card charging failed. You must settle this invoice via bank transfer or update your card.
          </p>
        )}
        {subscriptionStatus === "paused" && (
          <p>
            Your subscription billing is currently <strong className="text-zinc-900 dark:text-zinc-100">Paused</strong>. Service access is frozen, and auto-renew invoices will not be generated until you resume subscription.
          </p>
        )}
        {subscriptionStatus === "cancelled" && (
          <p>
            Your subscription has been <strong className="text-zinc-900 dark:text-zinc-100">Cancelled</strong>. Future renewals are terminated, and service access is closed.
          </p>
        )}
      </div>

      {/* Actions grid */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-850">
        {/* Pause Action */}
        {(subscriptionStatus === "active" || subscriptionStatus === "past_due") && (
          <button
            onClick={onPause}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors disabled:opacity-50"
          >
            {actionLoading === "pause" ? (
              <><Loader2 className="size-3.5 animate-spin" /> Pausing...</>
            ) : (
              <><Pause className="size-3.5" /> Pause Subscription</>
            )}
          </button>
        )}

        {/* Resume Action */}
        {subscriptionStatus === "paused" && (
          <button
            onClick={onResume}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {actionLoading === "resume" ? (
              <><Loader2 className="size-3.5 animate-spin" /> Resuming...</>
            ) : (
              <><Play className="size-3.5" /> Resume Subscription</>
            )}
          </button>
        )}

        {/* Cancel Action */}
        {subscriptionStatus !== "cancelled" && (
          <button
            onClick={onCancelClick}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 transition-colors disabled:opacity-50"
          >
            <XCircle className="size-3.5" />
            Cancel Subscription
          </button>
        )}

        {subscriptionStatus === "cancelled" && (
          <div className="flex gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-[#0c0c0e]/30 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 leading-normal font-semibold">
            <HelpCircle className="size-4 shrink-0 mt-0.5" />
            <span>
              To re-enable subscriptions, contact support or register a new card in the storefront checkouts.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
