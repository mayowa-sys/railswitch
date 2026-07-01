"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PlansTable } from "@/components/dashboard/plans/plans-table";
import { NewPlanModal } from "@/components/dashboard/plans/new-plan-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useApiData } from "@/lib/use-api-data";
import { api, type GatewayPlan } from "@/lib/api-client";
import { PLANS, type Plan as MockPlan } from "@/lib/mock-data";

function toMockPlan(p: GatewayPlan): MockPlan {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: typeof p.amount === "string" ? parseInt(p.amount) : p.amount,
    interval: p.interval as MockPlan["interval"],
    trialDays: 0,
    status: p.is_active ? "active" : "archived",
    subscriberCount: 0,
    createdAt: p.created_at,
  };
}

export default function PlansPage() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: apiPlans, refetch } = useApiData({
    fetcher: async () => {
      const KEY = user?.apiKey ?? "";
      const plans = await api.plans.list(KEY);
      return plans.map(toMockPlan);
    },
    mockData: PLANS,
    apiKey: "hardcoded",
  });

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

      <PlansTable externalPlans={apiPlans} />

      <NewPlanModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreate={refetch}
      />
    </div>
  );
}
