"use client";

import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusManagement } from "@/components/portal/settings/status-management";
import { CancelModal } from "@/components/portal/settings/cancel-modal";
import { loadPortalState, savePortalState, PLANS, getServerPortalState } from "@/lib/mock-data";
import { isMockMode, api, type GatewaySubscription, type GatewayPlan } from "@/lib/api-client";
import { useApiData } from "@/lib/use-api-data";
import { CheckCircle } from "lucide-react";

import { PORTAL_API_KEY as API_KEY } from "@/lib/config";

export default function SettingsPage() {
  const [state, setState] = useState(() => getServerPortalState());
  const [actionLoading, setActionLoading] = useState<"pause" | "resume" | "cancel" | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
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
        status: sub.status as string,
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
    };
  }, [mock, rawSubs, rawPlans]);

  const subscription = realData?.subscription ?? (state?.subscription || getServerPortalState().subscription);
  const currentPlan = realData?.currentPlan ?? (PLANS.find((p: any) => p.id === subscription.planId) || PLANS[0]);

  const handlePause = () => {
    setActionLoading("pause");
    setTimeout(() => {
      const updatedSub = { ...subscription, status: "paused" as const };
      savePortalState({ subscription: updatedSub });
      setState((s: any) => ({ ...s, subscription: updatedSub }));
      setActionLoading(null);
      setSuccessMsg("Subscription paused successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 600);
  };

  const handleResume = () => {
    setActionLoading("resume");
    setTimeout(() => {
      const updatedSub = { ...subscription, status: "active" as const };
      savePortalState({ subscription: updatedSub });
      setState((s: any) => ({ ...s, subscription: updatedSub }));
      setActionLoading(null);
      setSuccessMsg("Subscription resumed successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 600);
  };

  const handleCancelClick = () => {
    setSelectedReason(""); setOtherDetails(""); setCancelModalOpen(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedReason) return;
    setActionLoading("cancel");
    setCancelModalOpen(false);

    setTimeout(() => {
      const updatedSub = {
        ...subscription,
        status: "cancelled" as const,
        reason: selectedReason === "Other" ? `Other: ${otherDetails}` : selectedReason,
      };
      savePortalState({ subscription: updatedSub });
      setState((s: any) => ({ ...s, subscription: updatedSub }));
      setActionLoading(null);
      setSuccessMsg("Subscription cancelled.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portal Settings"
        description="Manage the operational lifecycle of your active subscription services."
      />

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
          <CheckCircle className="size-4" />
          {successMsg}
        </div>
      )}

      <StatusManagement
        subscriptionStatus={subscription.status}
        currentPlan={currentPlan}
        nextBillingDate={subscription.nextBillingDate}
        actionLoading={actionLoading}
        onPause={handlePause}
        onResume={handleResume}
        onCancelClick={handleCancelClick}
      />

      <CancelModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        selectedReason={selectedReason}
        onSelectReason={setSelectedReason}
        otherDetails={otherDetails}
        onOtherDetailsChange={setOtherDetails}
        onConfirm={handleConfirmCancel}
        applying={actionLoading === "cancel"}
      />
    </div>
  );
}
