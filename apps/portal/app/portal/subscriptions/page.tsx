"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadPortalState, savePortalState, formatNaira, PLANS, type Invoice } from "@/lib/mock-data";
import {
  CreditCard,
  Zap,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronRight,
  TrendingUp,
  X,
  FileText
} from "lucide-react";

export default function SubscriptionsPage() {
  const [state, setState] = useState(loadPortalState());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscription = state.subscription;
  const currentPlan = PLANS.find((p) => p.id === subscription.planId) || PLANS[0];
  const defaultCard = state.paymentMethods.find((pm) => pm.id === subscription.paymentMethodId) || state.paymentMethods[0];

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

      // Define current cycle dates (e.g., June 1, 2026 to July 1, 2026 -> 30 days)
      const periodStart = new Date("2026-06-15T00:00:00");
      const periodEnd = new Date("2026-07-15T00:00:00");
      
      // Calculate remaining days from today (June 25, 2026)
      const today = new Date("2026-06-25T00:00:00");
      
      const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / 86_400_000); // 30 days
      const remainingDays = Math.max(0, Math.ceil((periodEnd.getTime() - today.getTime()) / 86_400_000)); // 20 days

      // Engine proration math
      const creditAmount = (currentPlan.price / totalDays) * (totalDays - remainingDays);
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

      // Save to localStorage
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
      
      // Delay closing modal slightly for visual checkmark completion
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
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm">
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
                className="h-8 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg transition-colors"
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
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
              Next billing: {subscription.nextBillingDate}
            </p>
          </div>
          <div>
            <p className="font-semibold text-zinc-400 dark:text-zinc-500">Payment Rail</p>
            <p className="text-zinc-900 dark:text-zinc-200 mt-1 font-bold flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-zinc-400" />
              {defaultCard.type === "card" ? `${defaultCard.brand} •••• ${defaultCard.last4}` : `${defaultCard.bankName} •••• ${defaultCard.last4}`}
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
              {subscription.status === "active" ? "Auto-charge is active" : "Auto-billing disabled"}
            </p>
          </div>
        </div>
      </div>

      {/* Available Plans Comparison Widget */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm">
        <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Available Tiers Comparison</h4>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan.id;
            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-4 flex flex-col justify-between ${
                  isCurrent
                    ? "border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-extrabold text-zinc-900 dark:text-white">{plan.name}</p>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Current</span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">{plan.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-baseline gap-1">
                  <span className="text-base font-black text-zinc-900 dark:text-white">{formatNaira(plan.price)}</span>
                  <span className="text-[10px] text-zinc-500">/mo</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Plan Change Modal ─────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Change Subscription Plan</h3>
              <button
                onClick={() => setModalOpen(false)}
                disabled={applying}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-850"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {success ? (
                <div className="flex flex-col items-center justify-center text-center py-6">
                  <div className="size-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 animate-bounce">
                    <CheckCircle className="size-6" />
                  </div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Plan Changed Successfully</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Your subscription has been updated. A prorated invoice has been billed.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selector */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Choose a Plan</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PLANS.map((plan) => (
                        <button
                          key={plan.id}
                          onClick={() => handleSelectPlan(plan.id)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            selectedPlanId === plan.id
                              ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20"
                              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                          }`}
                        >
                          <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</p>
                          <p className="text-[10px] font-bold mt-1 text-zinc-500 dark:text-zinc-400">
                            {formatNaira(plan.price)}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Proration Live Preview */}
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-6 bg-zinc-50 dark:bg-[#0c0c0e]/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        <Loader2 className="size-4 animate-spin text-indigo-500" />
                        Fetching proration preview from Gateway...
                      </div>
                    </div>
                  ) : previewData ? (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0c0c0e]/30 p-4 space-y-3.5">
                      <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        Live Proration Invoice Details
                      </p>

                      <div className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50 text-xs font-medium space-y-2.5">
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                          <span>Unused {previewData.currentPlanName} credit ({previewData.totalDays - previewData.remainingDays} days)</span>
                          <span className="text-emerald-600 dark:text-emerald-400">-{formatNaira(previewData.credit)}</span>
                        </div>
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400 pt-2.5">
                          <span>Prorated {previewData.newPlanName} charge ({previewData.remainingDays} days)</span>
                          <span className="text-zinc-900 dark:text-zinc-100">+{formatNaira(previewData.charge)}</span>
                        </div>
                        <div className="flex justify-between pt-2.5 font-bold border-t border-zinc-200 dark:border-zinc-800 text-sm">
                          <span className="text-zinc-900 dark:text-zinc-100">Net Amount due immediately</span>
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {previewData.net < 0 ? `-${formatNaira(Math.abs(previewData.net))}` : formatNaira(previewData.net)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 text-[10px] text-indigo-700 dark:text-indigo-400 leading-normal font-semibold">
                        <AlertCircle className="size-4 shrink-0 text-indigo-500" />
                        <span>
                          Changing plan will charge {formatNaira(Math.max(0, previewData.net))} to your Visa card now. Your billing period stays unchanged, next full renewal is {previewData.billingDate}.
                        </span>
                      </div>
                    </div>
                  ) : selectedPlanId !== currentPlan.id ? (
                    <div className="text-center py-4 text-xs text-zinc-500">
                      Please select a different tier to display calculations.
                    </div>
                  ) : (
                    <div className="flex gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-[#0c0c0e]/30 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 leading-relaxed font-semibold">
                      <AlertCircle className="size-4 shrink-0" />
                      <span>This is your current plan. Select a different tier to view proration details.</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => setModalOpen(false)}
                      disabled={applying}
                      className="h-9 px-4 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmPlanChange}
                      disabled={applying || selectedPlanId === currentPlan.id || !previewData}
                      className="h-9 px-5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      {applying ? (
                        <><Loader2 className="size-3.5 animate-spin" /> Committing Changes...</>
                      ) : (
                        "Confirm Plan Change"
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
