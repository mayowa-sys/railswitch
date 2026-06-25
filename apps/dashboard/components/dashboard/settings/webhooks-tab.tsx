"use client";

import { useState, useCallback } from "react";
import {
  WEBHOOK_ENDPOINTS,
  WEBHOOK_DELIVERIES,
  type WebhookEndpoint,
  type WebhookDelivery,
  type DeliveryStatus,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";

// ─── Helpers ───────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncateUrl(url: string, max = 38): string {
  return url.length > max ? url.slice(0, max) + "…" : url;
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const ENDPOINT_STATUS_CONFIG: Record<WebhookEndpoint["status"], { label: string; className: string }> = {
  active:   { label: "Active",    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60" },
  failing:  { label: "Failing",   className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60" },
  disabled: { label: "Disabled",  className: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700" },
};

const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; icon: React.ElementType; className: string }> = {
  delivered:     { label: "Delivered",     icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  failed:        { label: "Failed",        icon: AlertCircle,  className: "text-red-600 dark:text-red-400" },
  pending_retry: { label: "Pending retry", icon: Clock,        className: "text-amber-600 dark:text-amber-400" },
};

function EndpointBadge({ status }: { status: WebhookEndpoint["status"] }) {
  const cfg = ENDPOINT_STATUS_CONFIG[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border tracking-wide", cfg.className)}>
      {cfg.label}
    </span>
  );
}

function DeliveryStatusCell({ status }: { status: DeliveryStatus }) {
  const cfg = DELIVERY_STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", cfg.className)}>
      <Icon className="size-3" />
      {cfg.label}
    </span>
  );
}

// ─── Signing secret reveal ─────────────────────────────────────────────────────

function SigningSecretRow({ endpoint }: { endpoint: WebhookEndpoint }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  function reveal() {
    setRevealed(true);
    // Auto-mask after 30s
    setTimeout(() => setRevealed(false), 30000);
  }

  function copy() {
    navigator.clipboard.writeText(endpoint.signingSecret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <code className="flex-1 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex items-center overflow-hidden truncate">
        {revealed ? endpoint.signingSecret : "whsec_" + "•".repeat(28)}
      </code>
      <button
        onClick={revealed ? () => setRevealed(false) : reveal}
        title={revealed ? "Hide" : "Reveal"}
        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button
        onClick={copy}
        title="Copy"
        className="h-8 w-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
      >
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

// ─── Endpoint card ─────────────────────────────────────────────────────────────

function EndpointCard({
  endpoint,
  onRemove,
}: {
  endpoint: WebhookEndpoint;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs font-mono font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[340px]">
              {endpoint.url}
            </code>
            <EndpointBadge status={endpoint.status} />
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">
            Added {new Date(endpoint.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
            {endpoint.lastDeliveryAt && ` · Last delivery ${timeAgo(endpoint.lastDeliveryAt)}`}
          </p>
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Signing secret</p>
            <SigningSecretRow endpoint={endpoint} />
          </div>
        </div>
        <button
          onClick={() => onRemove(endpoint.id)}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
          title="Remove endpoint"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Add endpoint form ─────────────────────────────────────────────────────────

function AddEndpointForm({ onAdd }: { onAdd: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  function submit() {
    if (!url.trim() || !url.startsWith("https://")) {
      setError("URL must start with https://");
      return;
    }
    setAdding(true);
    setTimeout(() => {
      onAdd(url.trim());
      setUrl("");
      setAdding(false);
      setOpen(false);
    }, 600);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition-colors"
      >
        <Plus className="size-3.5" /> Add endpoint
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-indigo-300/60 dark:border-indigo-700/50 bg-indigo-50/30 dark:bg-indigo-950/20 p-4 space-y-3">
      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">New webhook endpoint</p>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(""); }}
          placeholder="https://your-server.com/webhook"
          className="flex-1 h-9 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
        />
        <button
          onClick={submit}
          disabled={adding}
          className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {adding ? <Loader2 className="size-3.5 animate-spin" /> : "Add"}
        </button>
        <button
          onClick={() => { setOpen(false); setUrl(""); setError(""); }}
          className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── Delivery log table ────────────────────────────────────────────────────────

type DeliveryRow = WebhookDelivery & { _replaying?: boolean; _replayed?: boolean };

function DeliveryLogsSection({ endpoints }: { endpoints: WebhookEndpoint[] }) {
  const [rows, setRows] = useState<DeliveryRow[]>(
    [...WEBHOOK_DELIVERIES].sort((a, b) => new Date(b.deliveredAt).getTime() - new Date(a.deliveredAt).getTime())
  );
  const [page, setPage] = useState(0);

  const endpointMap = Object.fromEntries(endpoints.map((e) => [e.id, e]));
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const visible = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const replay = useCallback((id: string) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, _replaying: true } : r));
    setTimeout(() => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, _replaying: false, _replayed: true, status: "delivered", statusCode: 200, attempts: r.attempts + 1 }
            : r
        )
      );
    }, 900);
  }, []);

  const columns: Column<DeliveryRow>[] = [
    {
      key: "event",
      header: "Event",
      cell: (row) => (
        <code className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[180px] block">
          {row.event}
        </code>
      ),
    },
    {
      key: "endpoint",
      header: "Endpoint",
      cell: (row) => {
        const ep = endpointMap[row.endpointId];
        return (
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[160px] block">
            {ep ? truncateUrl(ep.url.replace("https://", ""), 30) : row.endpointId}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <DeliveryStatusCell status={row.status} />,
    },
    {
      key: "code",
      header: "Code",
      cell: (row) => (
        <span className={cn(
          "text-[11px] font-mono font-bold",
          row.statusCode && row.statusCode >= 200 && row.statusCode < 300
            ? "text-emerald-600 dark:text-emerald-400"
            : row.statusCode === null
            ? "text-zinc-400"
            : "text-red-600 dark:text-red-400"
        )}>
          {row.statusCode ?? "—"}
        </span>
      ),
    },
    {
      key: "attempts",
      header: "Attempts",
      cell: (row) => (
        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">{row.attempts}</span>
      ),
    },
    {
      key: "timestamp",
      header: "Time",
      cell: (row) => (
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{timeAgo(row.deliveredAt)}</span>
      ),
    },
    {
      key: "replay",
      header: "",
      cell: (row) => (
        <button
          onClick={() => replay(row.id)}
          disabled={row._replaying}
          className={cn(
            "inline-flex items-center gap-1 h-6 px-2 rounded-md text-[10px] font-semibold transition-colors",
            row._replayed
              ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400"
              : "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50"
          )}
        >
          {row._replaying ? (
            <Loader2 className="size-2.5 animate-spin" />
          ) : row._replayed ? (
            <><Check className="size-2.5" /> Replayed</>
          ) : (
            <><RefreshCw className="size-2.5" /> Replay</>
          )}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Delivery Logs</p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">{rows.length} events total</p>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="h-7 w-7 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="h-7 w-7 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>
      <DataTable
        columns={columns}
        data={visible}
        rowKey={(r) => r.id}
        emptyTitle="No deliveries yet"
        emptyDescription="Events will appear here once your endpoint receives traffic."
      />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

function generateEndpointId() {
  return "wep_" + Math.random().toString(36).slice(2, 8);
}

function generateSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return "whsec_" + Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function WebhooksTab() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>(WEBHOOK_ENDPOINTS);

  function addEndpoint(url: string) {
    const ep: WebhookEndpoint = {
      id: generateEndpointId(),
      url,
      status: "active",
      createdAt: new Date().toISOString(),
      lastDeliveryAt: null,
      signingSecret: generateSecret(),
    };
    setEndpoints((prev) => [ep, ...prev]);
  }

  function removeEndpoint(id: string) {
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* ── Endpoints ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Registered Endpoints</p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">
              RailSwitch will POST to these URLs on every subscription event.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <EndpointCard key={ep.id} endpoint={ep} onRemove={removeEndpoint} />
          ))}
          {endpoints.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No endpoints registered</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Add one below to start receiving events.</p>
            </div>
          )}
          <AddEndpointForm onAdd={addEndpoint} />
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800/60" />

      {/* ── Delivery logs ── */}
      <DeliveryLogsSection endpoints={endpoints} />
    </div>
  );
}
