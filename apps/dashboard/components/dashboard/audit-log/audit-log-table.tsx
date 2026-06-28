"use client";

import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import type { AuditEntry, SubscriptionStatus } from "@/lib/mock-data";
import { ArrowRight, Bot, User, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTOR_ICON = {
  system: Bot,
  merchant: Building2,
  customer: User,
};

const ACTOR_COLOR = {
  system: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
  merchant: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30",
  customer: "text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/50",
};

function isStatus(s: string): s is SubscriptionStatus {
  return ["active","past_due","cancelled","paused","trialing","created"].includes(s);
}

interface AuditLogTableProps {
  entries: AuditEntry[];
}

export function AuditLogTable({ entries }: AuditLogTableProps) {
  const columns: Column<AuditEntry>[] = [
    {
      key: "timestamp",
      header: "Timestamp",
      headerClassName: "w-[160px]",
      cell: (row) => (
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          {new Date(row.timestamp).toLocaleString("en-NG", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      cell: (row) => {
        const Icon = ACTOR_ICON[row.actorType] ?? User;
        return (
          <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full", ACTOR_COLOR[row.actorType])}>
            <Icon className="size-3" />
            {row.actorType === "system" ? "System" : row.actor.split("@")[0]}
          </span>
        );
      },
    },
    {
      key: "subscription",
      header: "Subscription",
      cell: (row) => (
        <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          {row.subscriptionId}
        </span>
      ),
    },
    {
      key: "transition",
      header: "Transition",
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.fromState === "—" ? (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">—</span>
          ) : isStatus(row.fromState) ? (
            <StatusBadge status={row.fromState as SubscriptionStatus} />
          ) : (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic">{row.fromState}</span>
          )}
          <ArrowRight className="size-3 text-zinc-300 dark:text-zinc-600 shrink-0" />
          <StatusBadge status={row.toState as SubscriptionStatus} />
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      cell: (row) => (
        <span className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-snug">
          {row.reason}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={entries}
      emptyTitle="No audit entries"
      emptyDescription="State transitions will appear here in real time."
    />
  );
}
