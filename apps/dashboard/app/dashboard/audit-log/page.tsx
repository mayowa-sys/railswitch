"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { AUDIT_LOG, type AuditEntry, type SubscriptionStatus } from "@/lib/mock-data";
import { PageHeader } from "@/components/shared/page-header";
import { AuditLogTable } from "@/components/dashboard/audit-log/audit-log-table";
import { AuditFilters } from "@/components/dashboard/audit-log/audit-filters";
import { Radio } from "lucide-react";

// Simulated live audit entries that get prepended every 10s
const LIVE_POOL: Omit<AuditEntry, "id" | "timestamp">[] = [
  { subscriptionId: "sub_a1b2c3", actor: "system", actorType: "system", fromState: "active", toState: "active", reason: "Billing cycle renewed — payment confirmed" },
  { subscriptionId: "sub_g7h8i9", actor: "chinedu.okafor@techbridge.com.ng", actorType: "customer", fromState: "active", toState: "paused", reason: "Customer paused subscription via portal" },
  { subscriptionId: "sub_m4n5o6", actor: "mayowa@naijamusicpro.ng", actorType: "merchant", fromState: "active", toState: "active", reason: "Merchant updated plan pricing" },
  { subscriptionId: "sub_p7q8r9", actor: "system", actorType: "system", fromState: "trialing", toState: "active", reason: "Trial ended — card charged successfully" },
];

let liveIdx = 0;

function generateLiveEntry(): AuditEntry {
  const template = LIVE_POOL[liveIdx % LIVE_POOL.length];
  liveIdx++;
  return {
    ...template,
    id: `aud_live_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([...AUDIT_LOG].reverse());
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [liveCount, setLiveCount] = useState(0);

  // Simulated live polling every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const newEntry = generateLiveEntry();
      setEntries((prev) => [newEntry, ...prev]);
      setLiveCount((n) => n + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const hasFilters = !!search || !!actorFilter || !!subscriptionFilter || !!timeFilter;

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const matchSearch =
        !search ||
        entry.reason.toLowerCase().includes(search.toLowerCase()) ||
        entry.actor.toLowerCase().includes(search.toLowerCase());
      const matchActor = !actorFilter || entry.actorType === actorFilter;
      const matchSub = !subscriptionFilter || entry.subscriptionId === subscriptionFilter;
      const matchTime = !timeFilter || (() => {
        const ts = new Date(entry.timestamp).getTime();
        const now = Date.now();
        if (timeFilter === "today") return now - ts < 86400000;
        if (timeFilter === "7d") return now - ts < 604800000;
        if (timeFilter === "30d") return now - ts < 2592000000;
        return true;
      })();
      return matchSearch && matchActor && matchSub && matchTime;
    });
  }, [entries, search, actorFilter, subscriptionFilter, timeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Every subscription state transition — timestamped, actor-attributed, and immutable."
        badge={
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <Radio className="size-2.5 animate-pulse" />
            Live
          </span>
        }
      />

      <AuditFilters
        search={search}
        onSearchChange={setSearch}
        actorFilter={actorFilter}
        onActorChange={setActorFilter}
        subscriptionFilter={subscriptionFilter}
        onSubscriptionChange={setSubscriptionFilter}
        timeFilter={timeFilter}
        onTimeChange={setTimeFilter}
        hasActiveFilters={hasFilters}
        onClearAll={() => {
          setSearch("");
          setActorFilter("");
          setSubscriptionFilter("");
          setTimeFilter("");
        }}
      />

      {liveCount > 0 && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in-0 slide-in-from-top-1 duration-300">
          +{liveCount} new {liveCount === 1 ? "entry" : "entries"} received live
        </p>
      )}

      <AuditLogTable entries={filtered} />
    </div>
  );
}
