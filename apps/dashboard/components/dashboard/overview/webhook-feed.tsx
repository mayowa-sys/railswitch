"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type GatewayWebhookDelivery, type GatewayWebhookEvent } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function WebhookFeed() {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<GatewayWebhookDelivery[]>([]);
  const [events, setEvents] = useState<GatewayWebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = user?.apiKey ?? "";
    if (!key) { setLoading(false); return; }
    
    const fetchData = () => {
      Promise.all([
      api.webhooks.deliveries.list(key),
      api.webhooks.events.list(key),
    ]).then(([dels, evts]) => {
      setDeliveries(dels.slice(0, 5));
      setEvents(evts);
      setLoading(false);
    }).catch(() => setLoading(false));
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user?.apiKey]);

  const getEventName = (eventId: string) => {
    const evt = events.find((e) => e.id === eventId);
    return evt?.event || eventId?.slice(0, 12) || "—";
  };

  const getStatusIcon = (status: string) => {
    if (status === "delivered") return <CheckCircle2 className="size-3 text-emerald-500" />;
    if (status === "failed") return <AlertCircle className="size-3 text-red-500" />;
    return <Clock className="size-3 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-zinc-100 rounded w-1/3" />
          <div className="h-3 bg-zinc-50 rounded w-full" />
          <div className="h-3 bg-zinc-50 rounded w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Webhooks</h3>
        <Link href="/dashboard/settings?tab=webhooks" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium">
          View all <ArrowRight className="size-3" />
        </Link>
      </div>
      {deliveries.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-zinc-400">
          <p>No webhook deliveries yet.</p>
          <p className="mt-1 text-xs">Events appear when Nomba sandbox fires payment notifications.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {deliveries.map((d) => (
            <div key={d.id} className="px-6 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
              {getStatusIcon(d.status)}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{getEventName(d.event_id)}</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {d.status} · {d.status_code || "—"} · {new Date(d.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
