"use client";

import { useState } from "react";
import type {} from "@/lib/mock-data";
import { PageHeader } from "@/components/shared/page-header";
import { PlansTable } from "@/components/dashboard/plans/plans-table";
import { NewPlanModal } from "@/components/dashboard/plans/new-plan-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function PlansPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Manage subscription plans available to your customers."
        action={
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-sm shadow-indigo-500/20"
          >
            <Plus className="size-3.5" />
            Create plan
          </Button>
        }
      />

      <PlansTable />

      <NewPlanModal
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
