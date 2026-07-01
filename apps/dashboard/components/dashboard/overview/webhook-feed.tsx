"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function WebhookFeed() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Webhooks</h3>
        <Link href="/dashboard/settings?tab=webhooks" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="px-6 py-8 text-center text-sm text-zinc-400">
        <p>Connect webhook endpoints to see delivery events here.</p>
        <p className="mt-1 text-xs">Webhook events appear when Nomba sandbox fires payment notifications.</p>
      </div>
    </div>
  );
}
