"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PlanComparison } from "@/components/portal/subscriptions/plan-comparison";
import { ChangePlanModal } from "@/components/portal/subscriptions/change-plan-modal";
import { loadPortalState, savePortalState, formatNaira, PLANS, type Invoice, type Subscription as PortalSubscription, type SubscriptionStatus, getServerPortalState } from "@/lib/mock-data";
import { isMockMode, api, type GatewaySubscription, type GatewayPlan } from "@/lib/api-client";
import { useApiData } from "@/lib/use-api-data";
import { CreditCard, Zap } from "lucide-react";

const API_KEY = "";

export default function SubscriptionsPage() {
  const [state, setState] = useState(() => getServerPortalState());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);
  const mock = isMockMode();

  const { data: rawSubs, isLoading: subsLoading } = useApiData({
    fetcher: (key) => api.subscriptions.list(key),
    mockData: [] as GatewaySubscription[],
    apiKey: API_KEY,
  });

  const { data: rawPlans, isLoading: plansLoading } = useApiData({
    fetcher: (key) => api.plans.list(key),
    mockData: [] as GatewayPlan[],
    apiKey: API_KEY,
  });

  const loading = !mock && (subsLoading || plansLoading);

  useEffect(() => {
    if (!mock) return;
    setState(loadPortalState());
    const handleStorageChange = () => { setState(loadPortalState()); };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [mock]);

  const realData = useMemo(() => {
    if (mock || rawSubs.length === 0) return null;
    const sub = rawSubs[0];
    const plan = rawPlans.find((p) => p.id === sub.plan_id);
    return {
      subscription: {
        id: sub.id,
        planId: sub.plan_id,
        status: sub.status as SubscriptionStatus,
        nextBillingDate: new Date(sub.current_period_end).toLocaleDateString("en-NG", {
          day: "numeric", month: "long", year: "numeric",
        }),
        paymentMethodId: "",
      },
      currentPlan: plan ? {
        id: plan.id,
        name: plan.name,
        description: plan.description ?? "",
        price: plan.amount,
        interval: (plan.interval === "year" ? "annually" : "monthly") as "monthly" | "annually",
      } : PLANS[0],
      plans: rawPlans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description ?? "",
        price: p.amount,
        interval: (p.interval === "year" ? "annually" : "monthly") as "monthly" | "annually",
      })),
      defaultCard: { type: "card" as const, last4: "—", brand: "Card", isDefault: true },
    };
  }, [mock, rawSubs, rawPlans]);

  const subscription = realData?.subscription ?? (state?.subscription || getServerPortalState().subscription);
  const currentPlan = realData?.currentPlan ?? (PLANS.find((p) => p.id === subscription.planId) || PLANS[0]);
  const allPlans = realData?.plans ?? PLANS;
  const defaultCard = realData?.defaultCard ?? ((state?.paymentMethods || getServerPortalState().paymentMethods).find((pm) => pm.id === subscription.paymentMethodId) || (state?.paymentMethods || getServerPortalState().paymentMethods)[0]);

  const handleOpenPlanModal = () => {
    setSelectedPlanId(currentPlan.id);
    setPreviewData(null);
    setSuccess(false);
    setModalOpen(true);
  };

  const calculateProrationPreview = async (newPlanId: string) => {
    if (newPlanId === currentPlan.id) { setPreviewData(null); return; }
    setPreviewLoading(true);

    if (!mock && rawSubs.length > 0 && rawPlans.length > 0) {
      try {
        const result = await api.preview(rawSubs[0].id, newPlanId, API_KEY);
        setPreviewData({
          currentPlanName: currentPlan.name,
          newPlanName: allPlans.find((p: any) => p.id === newPlanId)?.name ?? "",
          ...result,
        });
      } catch {
        setPreviewData(null);
      }
      setPreviewLoading(false);
      return;
    }

    setTimeout(() => {
      const newPlan = allPlans.find((p: any) => p.id === newPlanId);
      if (!newPlan) return;

      const periodStart = new Date("2026-06-15T00:00:00");
      const periodEnd = new Date("2026-07-15T00:00:00");
      const today = new Date("2026-06-25T00:00:00");

      const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86_400_000);
      const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - today.getTime()) / 86_400_000));

      const creditAmount = (currentPlan.price / totalDays) * remainingDays;
      const chargeAmount = (newPlan.price / totalDays) * remainingDays;
      const netAmount = chargeAmount - creditAmount;

      setPreviewData({
        currentPlanName: currentPlan.name,
        newPlanName: newPlan.name,
        totalDays, remainingDays,
        credit: Math.round(creditAmount),
        charge: Math.round(chargeAmount),
        net: Math.round(netAmount),
        billingDate: subscription.nextBillingDate,
      });
      setPreviewLoading(false);
    }, 500);
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    calculateProrationPreview(planId);
  };

  const handleConfirmPlanChange = () => {
    if (!selectedPlanId || selectedPlanId === currentPlan.id) return;
    setApplying(true);

    setTimeout(() => {
      const newPlan = allPlans.find((p: any) => p.id === selectedPlanId);
      if (!newPlan) return;

      if (!mock) {
        setApplying(false);
        setSuccess(true);
        setTimeout(() => setModalOpen(false), 1000);
        return;
      }

      const updatedSub = { ...subscription, planId: selectedPlanId } as PortalSubscription;
      const newInvoice: Invoice = {
        id: `INV-2026-00${state.invoices.length + 1}`,
        planName: `Prorated Upgrade: ${currentPlan.name} → ${newPlan.name}`,
        amount: previewData ? Math.max(0, previewData.net) : 0,
        status: "paid",
        date: "June 25, 2026",
        method: `${defaultCard.brand || "Card"} (•••• ${defaultCard.last4})`,
      };
      const updatedInvoices = [newInvoice, ...state.invoices];

      savePortalState({ subscription: updatedSub, invoices: updatedInvoices });
      setState((s: any) => ({ ...s, subscription: updatedSub, invoices: updatedInvoices }));
      setApplying(false);
      setSuccess(true);
      setTimeout(() => setModalOpen(false), 1000);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Configuration"
        description="Review your service plan features, renewal frequency, and change billing tiers."
      />

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121215] p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Zap className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Current Service Plan</h3>
              <p className="text-xl font-extrabold text-zinc-900 dark:text-white mt-0.5">{currentPlan.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={subscription.status} />
            {subscription.status !== "cancelled" && (
              <button
                onClick={handleOpenPlanModal}
                className="h-8 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors shadow-sm"
              >
                Change Plan
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-3 mt-6 text-xs">
          <div>
            <p className="font-semibold text-zinc-400 dark:text-zinc-500">Plan Description</p>
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-medium leading-relaxed">{currentPlan.description}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-400 dark:text-zinc-500">Pricing & Billing Date</p>
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-bold">{formatNaira(currentPlan.price)} / month</p>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 font-semibold">Next billing: {subscription.nextBillingDate}</p>
          </div>
          <div>
            <p className="font-semibold text-zinc-400 dark:text-zinc-500">Payment Rail</p>
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-bold flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-zinc-400" />
              {defaultCard.type === "card" ? `${defaultCard.brand || "Card"} •••• ${defaultCard.last4}` : `${defaultCard.bankName || "Bank"} •••• ${defaultCard.last4}`}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 font-semibold">
              {subscription.status === "active" ? "Auto-charge is active" : "Auto-billing disabled"}
            </p>
          </div>
        </div>
      </div>

      <PlanComparison currentPlan={currentPlan} />

      <ChangePlanModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        currentPlan={currentPlan}
        selectedPlanId={selectedPlanId}
        onSelectPlan={handleSelectPlan}
        previewLoading={previewLoading}
        previewData={previewData}
        applying={applying}
        success={success}
        onConfirm={handleConfirmPlanChange}
      />
    </div>
  );
}
