import { PageHeader } from "@/components/shared/page-header";
import { SubscriptionsTable } from "@/components/dashboard/subscriptions/subscriptions-table";
import { SUBSCRIPTIONS } from "@/lib/mock-data";

export default function SubscriptionsPage() {
  const activeCount = SUBSCRIPTIONS.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="View and manage all customer subscriptions."
        badge={
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
            {activeCount} active
          </span>
        }
      />

      <SubscriptionsTable />
    </div>
  );
}
