"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, type GatewayWebhookEndpoint, type GatewayWebhookDelivery, type GatewayWebhookEvent } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Copy, Check, Trash2, Plus, RefreshCw, Loader2, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";

const PAGE_SIZE = 8;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function EndpointBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    failing: { label: "Failing", className: "bg-red-50 text-red-700 border-red-200" },
    disabled: { label: "Disabled", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  };
  const cfg = config[status] || config.active;
  return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.className)}>{cfg.label}</span>;
}

function DeliveryStatusCell({ status }: { status: string }) {
  const config: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    delivered: { label: "Delivered", icon: CheckCircle2, className: "text-emerald-600" },
    failed: { label: "Failed", icon: AlertCircle, className: "text-red-600" },
    pending_retry: { label: "Pending retry", icon: Clock, className: "text-amber-600" },
    pending: { label: "Pending", icon: Clock, className: "text-amber-600" },
  };
  const cfg = config[status] || { label: status, icon: Clock, className: "text-zinc-500" };
  const Icon = cfg.icon;
  return <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", cfg.className)}><Icon className="size-3" />{cfg.label}</span>;
}

export function WebhooksTab() {
  const { user } = useAuth();
  const API_KEY = user?.apiKey ?? "";
  const [endpoints, setEndpoints] = useState<GatewayWebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<GatewayWebhookDelivery[]>([]);
  const [events, setEvents] = useState<GatewayWebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchData = useCallback(() => {
    if (!API_KEY) return;
    setLoading(true);
    Promise.all([
      api.webhooks.endpoints.list(API_KEY),
      api.webhooks.deliveries.list(API_KEY),
      api.webhooks.events.list(API_KEY),
    ]).then(([eps, dels, evts]) => {
      setEndpoints(eps);
      setDeliveries(dels.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setEvents(evts);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [API_KEY]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const addEndpoint = async () => {
    if (!newUrl.startsWith("https://")) return;
    setAdding(true);
    try {
      await api.webhooks.endpoints.create(newUrl, API_KEY);
      setNewUrl("");
      setAddOpen(false);
      fetchData();
    } catch {}
    setAdding(false);
  };

  const removeEndpoint = async (id: string) => {
    try {
      await api.webhooks.endpoints.remove(id, API_KEY);
      fetchData();
    } catch {}
  };

  const replayDelivery = async (id: string) => {
    try {
      await api.webhooks.deliveries.replay(id, API_KEY);
      fetchData();
    } catch {}
  };

  const totalPages = Math.ceil(deliveries.length / PAGE_SIZE);
  const visible = deliveries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: Column<GatewayWebhookDelivery>[] = [
    { key: "event", header: "Event", cell: (row) => { const evt = events.find(e => e.id === row.event_id); return <code className="text-[11px] font-mono truncate max-w-[160px] block">{evt?.event || row.event_id?.slice(0, 12) || "—"}</code>; } },
    { key: "endpoint", header: "Endpoint", cell: (row) => <span className="text-[11px] text-zinc-500 font-mono truncate max-w-[140px] block">{endpoints.find(e => e.id === row.endpoint_id)?.url?.replace("https://", "")?.slice(0, 30) || row.endpoint_id}</span> },
    { key: "status", header: "Status", cell: (row) => <DeliveryStatusCell status={row.status} /> },
    { key: "code", header: "Code", cell: (row) => <span className={cn("text-[11px] font-mono font-bold", row.status_code && row.status_code < 300 ? "text-emerald-600" : "text-red-600")}>{row.status_code ?? "—"}</span> },
    { key: "attempts", header: "Attempts", cell: (row) => <span className="text-[11px] tabular-nums">{row.attempts}</span> },
    { key: "time", header: "Time", cell: (row) => <span className="text-[11px] text-zinc-400">{row.created_at ? timeAgo(row.created_at) : "—"}</span> },
    { key: "replay", header: "", cell: (row) => <button onClick={() => replayDelivery(row.id)} className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><RefreshCw className="size-2.5" /> Replay</button> },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Registered Endpoints</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">RailSwitch will POST to these URLs on every subscription event.</p>
          </div>
        </div>
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <div key={ep.id} className="rounded-xl border bg-white dark:bg-[#121215] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs font-mono font-medium truncate max-w-[340px]">{ep.url}</code>
                    <EndpointBadge status={ep.status} />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Added {new Date(ep.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    {ep.last_delivery_at && ` · Last delivery ${timeAgo(ep.last_delivery_at)}`}
                  </p>
                </div>
                <button onClick={() => removeEndpoint(ep.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"><Trash2 className="size-4" /></button>
              </div>
            </div>
          ))}
          {endpoints.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center"><p className="text-sm text-zinc-500">No endpoints registered</p></div>}
          {!addOpen ? (
            <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-zinc-300 text-xs font-medium text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"><Plus className="size-3.5" /> Add endpoint</button>
          ) : (
            <div className="rounded-xl border border-indigo-300/60 bg-indigo-50/30 p-4 space-y-3">
              <p className="text-xs font-semibold">New webhook endpoint</p>
              <div className="flex items-center gap-2">
                <input autoFocus value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://your-server.com/webhook" className="flex-1 h-9 rounded-lg border bg-white px-3 text-sm outline-none focus:border-indigo-400" />
                <button onClick={addEndpoint} disabled={adding} className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">{adding ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}</button>
                <button onClick={() => { setAddOpen(false); setNewUrl(""); }} className="h-9 px-3 rounded-lg border text-sm hover:bg-zinc-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-zinc-100" />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Delivery Logs</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{deliveries.length} events total</p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-7 w-7 rounded-md border flex items-center justify-center disabled:opacity-30"><ChevronLeft className="size-3.5" /></button>
              <span className="text-[11px] px-1">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="h-7 w-7 rounded-md border flex items-center justify-center disabled:opacity-30"><ChevronRight className="size-3.5" /></button>
            </div>
          )}
        </div>
        <DataTable columns={columns} data={visible} rowKey={(r) => r.id} emptyTitle="No deliveries yet" emptyDescription="Events will appear here once your endpoint receives traffic." />
      </section>
    </div>
  );
}
