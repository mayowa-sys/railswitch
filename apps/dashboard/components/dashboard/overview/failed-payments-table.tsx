"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FailedPaymentsTable() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Failed Payment Queue</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">0 payments in recovery</p>
        </div>
        <Link href="/dashboard/subscriptions?status=past_due" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="px-6 py-8 text-center text-sm text-zinc-400">
        No failed payments in queue. All subscriptions are active and healthy.
      </div>
    </div>
  );
}
