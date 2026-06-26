"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { PlanComparison } from "@/components/portal/subscriptions/plan-comparison";
import { ChangePlanModal } from "@/components/portal/subscriptions/change-plan-modal";
import { loadPortalState, savePortalState, formatNaira, PLANS, type Invoice, getServerPortalState } from "@/lib/mock-data";
import { CreditCard, Zap, Calendar } from "lucide-react";

export default function SubscriptionsPage() {
  const [state, setState] = useState(() => getServerPortalState());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Hydrate state from localStorage on mount
    setState(loadPortalState());

    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscription = state?.subscription || getServerPortalState().subscription;
  const currentPlan = PLANS.find((p) => p.id === subscription.planId) || PLANS[0];
  const defaultCard = (state?.paymentMethods || getServerPortalState().paymentMethods).find((pm) => pm.id === subscription.paymentMethodId) || (state?.paymentMethods || getServerPortalState().paymentMethods)[0];

  const handleOpenPlanModal = () => {
    setSelectedPlanId(currentPlan.id);
    setPreviewData(null);
    setSuccess(false);
    setModalOpen(true);
  };

  // Run live proration preview calculation (mocking the gateway endpoint)
  const calculateProrationPreview = (newPlanId: string) => {
    if (newPlanId === currentPlan.id) {
      setPreviewData(null);
      return;
    }

    setPreviewLoading(true);

    // Simulate gateway request latency
    setTimeout(() => {
      const newPlan = PLANS.find((p) => p.id === newPlanId);
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
        totalDays,
        remainingDays,
        credit: Math.round(creditAmount),
        charge: Math.round(chargeAmount),
        net: Math.round(netAmount),
        billingDate: subscription.nextBillingDate
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
      const newPlan = PLANS.find((p) => p.id === selectedPlanId);
      if (!newPlan) return;

      // 1. Update subscription plan
      const updatedSub = {
        ...subscription,
        planId: selectedPlanId,
      };

      // 2. Add new prorated invoice to history
      const newInvoice: Invoice = {
        id: `INV-2026-00${state.invoices.length + 1}`,
        planName: `Prorated Upgrade: ${currentPlan.name} ➔ ${newPlan.name}`,
        amount: previewData ? Math.max(0, previewData.net) : 0,
        status: "paid",
        date: "June 25, 2026",
        method: `${defaultCard.brand || "Card"} (•••• ${defaultCard.last4})`,
      };

      const updatedInvoices = [newInvoice, ...state.invoices];

      savePortalState({
        subscription: updatedSub,
        invoices: updatedInvoices
      });

      setState((s) => ({
        ...s,
        subscription: updatedSub,
        invoices: updatedInvoices
      }));

      setApplying(false);
      setSuccess(true);

      setTimeout(() => {
        setModalOpen(false);
      }, 1000);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Configuration"
        description="Review your service plan features, renewal frequency, and change billing tiers."
      />

      {/* Subscription Card */}
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
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-medium leading-relaxed">
              {currentPlan.description}
            </p>
          </div>
          <div>
            <p className="font-semibold text-zinc-400 dark:text-zinc-500">Pricing & Billing Date</p>
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-bold">
              {formatNaira(currentPlan.price)} / month
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 font-semibold">
              Next billing: {subscription.nextBillingDate}
            </p>
          </div>
          <div>
            <p className="font-semibold text-zinc-400 dark:text-zinc-500">Payment Rail</p>
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-bold flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-zinc-400" />
              {defaultCard.type === "card" ? `${defaultCard.brand} •••• ${defaultCard.last4}` : `${defaultCard.bankName} •••• ${defaultCard.last4}`}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 font-semibold">
              {subscription.status === "active" ? "Auto-charge is active" : "Auto-billing disabled"}
            </p>
          </div>
        </div>
      </div>

      {/* Available Plans Comparison Widget */}
      <PlanComparison currentPlan={currentPlan} />

      {/* Plan Change Modal */}
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
