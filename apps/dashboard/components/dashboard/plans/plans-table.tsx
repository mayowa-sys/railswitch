"use client";

import { useState } from "react";
import { PLANS, formatNaira, type Plan } from "@/lib/mock-data";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmModal } from "@/components/shared/confirm-modal";
import { EditPlanModal } from "@/components/dashboard/plans/edit-plan-modal";
import { Button } from "@/components/ui/button";
import { Pencil, Archive, Users } from "lucide-react";

const INTERVAL_LABEL: Record<string, string> = {
  monthly: "/ mo",
  quarterly: "/ qtr",
  annually: "/ yr",
};

export function PlansTable() {
  const [plans, setPlans] = useState<Plan[]>(PLANS);
  const [editTarget, setEditTarget] = useState<Plan | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Plan | null>(null);
  const [archiving, setArchiving] = useState(false);

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    setTimeout(() => {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === archiveTarget.id ? { ...p, status: "archived" } : p
        )
      );
      setArchiving(false);
      setArchiveTarget(null);
    }, 800);
  }

  function handleSave(updated: Plan) {
    setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditTarget(null);
  }

  const columns: Column<Plan>[] = [
    {
      key: "name",
      header: "Plan",
      cell: (row) => (
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.name}</p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xs truncate">
            {row.description}
          </p>
        </div>
      ),
    },
    {
      key: "price",
      header: "Price",
      cell: (row) => (
        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
          {formatNaira(row.price)}
          <span className="text-[11px] font-normal text-zinc-400 ml-0.5">
            {INTERVAL_LABEL[row.interval]}
          </span>
        </span>
      ),
    },
    {
      key: "trial",
      header: "Trial",
      cell: (row) => (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {row.trialDays > 0 ? `${row.trialDays} days` : "—"}
        </span>
      ),
    },
    {
      key: "subscribers",
      header: "Subscribers",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
          <Users className="size-3.5 text-zinc-400" />
          {row.subscriberCount.toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      header: "",
      headerClassName: "w-[80px]",
      cell: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => { e.stopPropagation(); setEditTarget(row); }}
            className="size-7 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Edit plan"
          >
            <Pencil className="size-3.5" />
          </Button>
          {row.status === "active" && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => { e.stopPropagation(); setArchiveTarget(row); }}
              className="size-7 text-zinc-400 hover:text-red-600"
              title="Archive plan"
            >
              <Archive className="size-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={plans}
        emptyTitle="No plans yet"
        emptyDescription="Create your first subscription plan to get started."
      />

      {editTarget && (
        <EditPlanModal
          open={!!editTarget}
          plan={editTarget}
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSave={handleSave}
        />
      )}

      <ConfirmModal
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title="Archive plan?"
        body={`Archiving "${archiveTarget?.name}" will prevent new subscribers. Existing subscribers keep their plan until they cancel.`}
        confirmLabel="Archive plan"
        onConfirm={handleArchive}
        loading={archiving}
      />
    </>
  );
}
