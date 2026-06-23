"use client";

import { WEBHOOK_EVENTS } from "@/lib/mock-data";
import { ArrowRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WebhookFeed() {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Webhooks
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Last {WEBHOOK_EVENTS.length} deliveries
          </p>
        </div>
        <button className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline">
          View all <ArrowRight className="size-3" />
        </button>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {WEBHOOK_EVENTS.slice(0, 6).map((ev) => {
          const isSuccess = ev.statusCode >= 200 && ev.statusCode < 300;
          const isTimeout = ev.latency > 3000;
          return (
            <div
              key={ev.id}
              className="px-6 py-3 flex items-center gap-3 group hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors"
            >
              {/* Status icon */}
              <div className="shrink-0">
                {isSuccess ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : isTimeout ? (
                  <Clock className="size-4 text-amber-500" />
                ) : (
                  <XCircle className="size-4 text-red-500" />
                )}
              </div>

              {/* Event + endpoint */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate font-mono">
                  {ev.event}
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                  {ev.endpoint.replace("https://", "")}
                </p>
              </div>

              {/* Meta */}
              <div className="shrink-0 text-right">
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    isSuccess
                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                      : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30"
                  )}
                >
                  {ev.statusCode}
                </span>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {ev.latency}ms · {timeAgo(ev.deliveredAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
