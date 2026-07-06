"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function FailedPaymentsTable() {
  const { user } = useAuth();
  const [pastDueCount, setPastDueCount] = useState(0);
  const [pastDueSubs, setPastDueSubs] = useState<Array<{id: string; state: string}>>([]);

  useEffect(() => {
    if (!user?.apiKey) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${API}/v1/subscriptions`, { headers: { Authorization: `Bearer ${user.apiKey}` } })
      .then(r => r.json())
      .then(d => {
        const data = d.data || [];
        const recovery = data.filter((s: any) => 
          s.state === "past_due" || s.state === "va_fallback" || s.state === "retrying" || s.state === "whatsapp_fallback"
        );
        setPastDueSubs(recovery.slice(0, 10));
        setPastDueCount(recovery.length);
      })
      .catch(() => {});
  }, [user?.apiKey]);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Failed Payment Queue</h3>
          <p className="text-[11px] text-zinc-400 mt-0.5">{pastDueCount} subscription{pastDueCount !== 1 ? "s" : ""} in recovery</p>
        </div>
        {pastDueCount > 0 && (
          <Link href="/dashboard/subscriptions" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
            View all <ArrowRight className="size-3" />
          </Link>
        )}
      </div>
      {pastDueCount === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-zinc-400">
          No failed payments in queue. All subscriptions are active and healthy.
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {pastDueSubs.map((sub) => (
            <div key={sub.id} className="px-6 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono text-zinc-500">{sub.id.slice(0, 14)}…</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                  sub.state === "va_fallback" ? "bg-amber-50 text-amber-700" :
                  sub.state === "retrying" ? "bg-blue-50 text-blue-700" :
                  sub.state === "whatsapp_fallback" ? "bg-emerald-50 text-emerald-700" :
                  "bg-red-50 text-red-700"
                }`}>
                  {sub.state.replace(/_/g, " ")}
                </span>
              </div>
              <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">Recovery</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
