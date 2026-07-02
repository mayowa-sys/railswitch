"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type GatewaySubscription } from "@/lib/api-client";

export function FailedPaymentsTable() {
  const { user } = useAuth();
  const [pastDueSubs, setPastDueSubs] = useState<GatewaySubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = user?.apiKey ?? "";
    if (!key) { setLoading(false); return; }
    api.subscriptions.list(key).then((subs) => {
      setPastDueSubs(subs.filter((s) => s.state === "past_due" || s.state === "va_fallback" || s.state === "whatsapp_fallback"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.apiKey]);

  const recoveryCount = pastDueSubs.length;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Failed Payment Queue</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {loading ? "Loading..." : `${recoveryCount} ${recoveryCount === 1 ? "subscription" : "subscriptions"} in recovery`}
          </p>
        </div>
        <Link href="/dashboard/subscriptions?status=past_due" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      {recoveryCount === 0 && !loading ? (
        <div className="px-6 py-8 text-center text-sm text-zinc-400">
          No failed payments in queue. All subscriptions are active and healthy.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {pastDueSubs.slice(0, 3).map((sub) => (
            <div key={sub.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{sub.id.slice(0, 16)}…</p>
                <p className="text-[10px] text-zinc-400 mt-0.5 capitalize">{sub.state.replace("_", " ")}</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Recovery
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
