"use client";

import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { DataTable, type Column } from "@/components/shared/data-table";
import { useAuth } from "@/lib/auth-context";
import { api, type GatewayAuditEntry } from "@/lib/api-client";
import { StatusBadge } from "@/components/shared/status-badge";
import { Radio, ArrowRight, Bot, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTOR_ICON = { system: Bot, merchant: Building2, customer: User };
const ACTOR_COLOR = {
  system: "text-violet-600 bg-violet-50 dark:bg-violet-950/30",
  merchant: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
  customer: "text-zinc-600 bg-zinc-100 dark:bg-zinc-800/50",
};

const ACTOR_OPTIONS = [
  { value: "system", label: "System" },
  { value: "merchant", label: "Merchant" },
  { value: "customer", label: "Customer" },
];

const TIME_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function isStatus(s: string): boolean {
  return ["active","past_due","cancelled","paused","trialing","charging","retrying","va_fallback","ussd_fallback","whatsapp_fallback","refunded","created"].includes(s);
}

interface AuditEntry {
  id: string;
  subscriptionId: string;
  actor: string;
  actorType: string;
  fromState: string;
  toState: string;
  reason: string;
  timestamp: string;
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchAuditLogs = () => {
    const key = user?.apiKey ?? "";
    if (!key) { setLoading(false); return; }
    setLoading(true);
    api.auditLogs.list(key)
      .then((data) => {
        setEntries(data.map((e) => ({
          id: e.id,
          subscriptionId: e.subscription_id,
          actor: e.actor,
          actorType: e.actor,
          fromState: e.from_state,
          toState: e.to_state,
          reason: e.reason,
          timestamp: e.timestamp,
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(fetchAuditLogs, [user?.apiKey]);

  // Poll every 15 seconds for new entries
  useEffect(() => {
    const interval = setInterval(fetchAuditLogs, 15000);
    return () => clearInterval(interval);
  }, [user?.apiKey]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (search) {
        const q = search.toLowerCase();
        if (!entry.reason.toLowerCase().includes(q) && !entry.actor.toLowerCase().includes(q) && !entry.subscriptionId.toLowerCase().includes(q)) return false;
      }
      if (actorFilter && entry.actorType !== actorFilter) return false;
      if (timeFilter) {
        const ts = new Date(entry.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === "today" && now - ts > 86400000) return false;
        if (timeFilter === "7d" && now - ts > 604800000) return false;
        if (timeFilter === "30d" && now - ts > 2592000000) return false;
      }
      return true;
    });
  }, [entries, search, actorFilter, timeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const hasFilters = !!search || !!actorFilter || !!timeFilter;

  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) { for (let i = 0; i < totalPages; i++) pages.push(i); }
    else {
      pages.push(0);
      if (page > 3) pages.push("...");
      for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i);
      if (page < totalPages - 4) pages.push("...");
      pages.push(totalPages - 1);
    }
    return pages;
  }, [totalPages, page]);

  const columns: Column<AuditEntry>[] = [
    {
      key: "timestamp", header: "Timestamp", headerClassName: "w-[160px]",
      cell: (row) => (
        <span className="text-[11px] font-mono text-zinc-500">
          {new Date(row.timestamp).toLocaleString("en-NG", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      ),
    },
    {
      key: "actor", header: "Actor",
      cell: (row) => {
        const Icon = ACTOR_ICON[row.actorType as keyof typeof ACTOR_ICON] ?? User;
        return (
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full", ACTOR_COLOR[row.actorType as keyof typeof ACTOR_COLOR])}>
            <Icon className="size-3" />
            {row.actorType === "system" ? "System" : row.actorType === "merchant" ? "Merchant" : row.actor.split("@")[0]}
          </span>
        );
      },
    },
    {
      key: "subscription", header: "Subscription",
      cell: (row) => (
        <span className="text-[11px] font-mono text-zinc-500">{row.subscriptionId.slice(0, 12)}…</span>
      ),
    },
    {
      key: "transition", header: "Transition",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.fromState === "—" ? (
            <span className="text-[11px] text-zinc-400 italic">—</span>
          ) : isStatus(row.fromState) ? (
            <StatusBadge status={row.fromState as any} />
          ) : (
            <span className="text-[11px] text-zinc-400 italic">{row.fromState}</span>
          )}
          <ArrowRight className="size-3 text-zinc-300 shrink-0" />
          <StatusBadge status={row.toState as any} />
        </div>
      ),
    },
    {
      key: "reason", header: "Reason",
      cell: (row) => <span className="text-[11px] text-zinc-600 leading-snug">{row.reason}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Log" description={`${entries.length} state transitions recorded — immutable and timestamped.`} />

      <SearchFilterBar
        searchValue={search} onSearchChange={(v) => { setSearch(v); setPage(0); }}
        searchPlaceholder="Search by reason, actor, or subscription…"
        filters={[
          { key: "actor", placeholder: "All actors", options: ACTOR_OPTIONS, value: actorFilter, onChange: (v) => { setActorFilter(v); setPage(0); } },
          { key: "time", placeholder: "Any time", options: TIME_OPTIONS, value: timeFilter, onChange: (v) => { setTimeFilter(v); setPage(0); } },
        ]}
        hasActiveFilters={hasFilters}
        onClearAll={() => { setSearch(""); setActorFilter(""); setTimeFilter(""); setPage(0); }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="size-5 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600" /></div>
      ) : (
        <>
          <DataTable columns={columns} data={paged} rowKey={(row) => row.id} emptyTitle="No audit entries" emptyDescription="State transitions will appear here." />
          {totalPages > 1 && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="h-7 px-2.5 rounded text-xs font-medium border disabled:opacity-30 hover:bg-zinc-100 transition-colors">Prev</button>
                {pageNumbers.map((p, i) => p === "..." ? <span key={`e-${i}`} className="w-7 text-center text-xs text-zinc-400">…</span> : <button key={p} onClick={() => setPage(p as number)} className={`h-7 w-7 rounded text-xs font-medium transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'border hover:bg-zinc-100'}`}>{(p as number) + 1}</button>)}
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="h-7 px-2.5 rounded text-xs font-medium border disabled:opacity-30 hover:bg-zinc-100 transition-colors">Next</button>
              </div>
              <p className="text-[11px] text-zinc-400">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
