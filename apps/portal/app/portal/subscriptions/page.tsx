"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PlanComparison } from "@/components/portal/subscriptions/plan-comparison";
import { ChangePlanModal } from "@/components/portal/subscriptions/change-plan-modal";
import { api, type GatewaySubscription, type GatewayPlan } from "@/lib/api-client";
import { CreditCard, Zap, Loader2 } from "lucide-react";

export default function SubscriptionsPage() {
  const [subscription, setSubscription] = useState<GatewaySubscription | null>(null);
  const [plans, setPlans] = useState<GatewayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchData = () => {
    Promise.all([api.subscriptions.list(), api.plans.list()])
      .then(([subs, plansData]) => { const s = Array.isArray(subs) ? (subs.length > 0 ? subs[0] : null) : subs; setSubscription(s); setPlans(plansData.filter(p => p.is_active)); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;
  if (!subscription) return <div className="py-12 text-center"><p className="text-sm text-zinc-500">No subscription found</p></div>;

  const plan = plans.find((p) => p.id === subscription.plan_id);
  const currentPlan = { id: plan?.id ?? "", name: plan?.name ?? "Unknown", description: plan?.description ?? "", price: Number(plan?.amount ?? 0), interval: (plan?.interval === "annual" ? "annually" : "monthly") as "monthly" | "annually" };
  const nextBilling = new Date(subscription.current_period_end).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });
  const formatNaira = (kobo: number) => `₦${(kobo / 100).toLocaleString()}`;

  const handleOpenPlanModal = () => { setSelectedPlanId(currentPlan.id); setPreviewData(null); setSuccess(false); setModalOpen(true); };

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlanId(planId);
    if (planId === currentPlan.id) { setPreviewData(null); return; }
    setPreviewLoading(true);
    try {
      if (!subscription) return;
      const result = await api.subscriptions.preview(subscription.id, planId);
      setPreviewData({ ...result, currentPlanName: currentPlan.name, newPlanName: plans.find(p => p.id === planId)?.name ?? "" });
    } catch { setPreviewData(null); }
    setPreviewLoading(false);
  };

  const handleConfirmPlanChange = async () => {
    if (!selectedPlanId || selectedPlanId === currentPlan.id) return;
    setApplying(true);
    try {
      if (!subscription) return; await api.subscriptions.changePlan(subscription.id, selectedPlanId);
      setSuccess(true);
      fetchData();
    } catch {}
    setApplying(false);
    setTimeout(() => setModalOpen(false), 1000);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Subscription" description="Review your plan and change billing tiers." />
      <div className="rounded-xl border bg-white dark:bg-[#121215] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><Zap className="size-5" /></div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-500 uppercase">Current Plan</h3>
              <p className="text-xl font-extrabold mt-0.5">{currentPlan.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={subscription.state as any} />
            {subscription.state !== "cancelled" && <button onClick={handleOpenPlanModal} className="h-8 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors">Change Plan</button>}
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-3 mt-6 text-xs">
          <div><p className="font-semibold text-zinc-400">Description</p><p className="mt-1 font-medium">{currentPlan.description}</p></div>
          <div><p className="font-semibold text-zinc-400">Pricing</p><p className="mt-1 font-bold">{formatNaira(currentPlan.price)} / month</p><p className="text-zinc-500 mt-0.5">Next: {nextBilling}</p></div>
          <div><p className="font-semibold text-zinc-400">Status</p><p className="mt-1 font-bold flex items-center gap-1.5"><CreditCard className="size-3.5 text-zinc-400" />{subscription.state === "active" ? "Auto-charge active" : "Auto-billing disabled"}</p></div>
        </div>
      </div>
      <PlanComparison currentPlan={currentPlan} />
      <ChangePlanModal open={modalOpen} onOpenChange={setModalOpen} currentPlan={currentPlan} selectedPlanId={selectedPlanId} onSelectPlan={handleSelectPlan} previewLoading={previewLoading} previewData={previewData} applying={applying} success={success} onConfirm={handleConfirmPlanChange} />
    </div>
  );
}
