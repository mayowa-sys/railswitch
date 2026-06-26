"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusManagement } from "@/components/portal/settings/status-management";
import { CancelModal } from "@/components/portal/settings/cancel-modal";
import { loadPortalState, savePortalState, PLANS, getServerPortalState } from "@/lib/mock-data";
import { CheckCircle } from "lucide-react";

export default function SettingsPage() {
  const [state, setState] = useState(() => getServerPortalState());
  const [actionLoading, setActionLoading] = useState<"pause" | "resume" | "cancel" | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

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

  const handlePause = () => {
    setActionLoading("pause");
    setTimeout(() => {
      const updatedSub = {
        ...subscription,
        status: "paused" as const,
      };

      savePortalState({ subscription: updatedSub });
      setState((s) => ({ ...s, subscription: updatedSub }));
      setActionLoading(null);
      setSuccessMsg("Subscription paused successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 600);
  };

  const handleResume = () => {
    setActionLoading("resume");
    setTimeout(() => {
      const updatedSub = {
        ...subscription,
        status: "active" as const,
      };

      savePortalState({ subscription: updatedSub });
      setState((s) => ({ ...s, subscription: updatedSub }));
      setActionLoading(null);
      setSuccessMsg("Subscription resumed successfully.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }, 600);
  };

  const handleCancelClick = () => {
    setSelectedReason("");
    setOtherDetails("");
    setCancelModalOpen(true);
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
      setState((s) => ({ ...s, subscription: updatedSub }));
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

      {/* Subscription Status Management */}
      <StatusManagement
        subscriptionStatus={subscription.status}
        currentPlan={currentPlan}
        nextBillingDate={subscription.nextBillingDate}
        actionLoading={actionLoading}
        onPause={handlePause}
        onResume={handleResume}
        onCancelClick={handleCancelClick}
      />

      {/* Cancellation Reason Modal */}
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
