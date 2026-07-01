"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PlansTable } from "@/components/dashboard/plans/plans-table";
import { NewPlanModal } from "@/components/dashboard/plans/new-plan-modal";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, type GatewayPlan } from "@/lib/api-client";
import { type Plan as MockPlan } from "@/lib/mock-data";

function computePlans(rawPlans: GatewayPlan[], rawSubs: { plan_id: string; state: string }[]): MockPlan[] {
  const subCounts: Record<string, number> = {};
  for (const s of rawSubs) { subCounts[s.plan_id] = (subCounts[s.plan_id] || 0) + 1; }
  return rawPlans.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: typeof p.amount === "string" ? parseInt(p.amount) * 100 : p.amount * 100,
    interval: p.interval as MockPlan["interval"],
    trialDays: 0,
    status: p.is_active ? "active" : "archived",
    subscriberCount: subCounts[p.id] || 0,
    createdAt: p.created_at,
  }));
}

export default function PlansPage() {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [plans, setPlans] = useState<MockPlan[] | null>(null);

  const fetchPlans = () => {
    const key = user?.apiKey;
    if (!key) return;
    Promise.all([api.plans.list(key), api.subscriptions.list(key)])
      .then(([rawPlans, rawSubs]) => {
        setPlans(computePlans(rawPlans, rawSubs.map((s) => ({ plan_id: s.plan_id, state: s.state }))));
      })
      .catch(() => {});
  };

  useEffect(fetchPlans, [user?.apiKey]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Manage subscription plans available to your customers."
        action={
          <Button size="sm" onClick={() => setModalOpen(true)}
            className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-sm shadow-indigo-500/20">
            <Plus className="size-3.5" /> Create plan
          </Button>
        }
      />
      {plans === null ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>
      ) : (
        <PlansTable externalPlans={plans} />
      )}
      <NewPlanModal open={modalOpen} onOpenChange={setModalOpen} onCreate={fetchPlans} />
    </div>
  );
}
