"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { loadPortalState, savePortalState, PLANS } from "@/lib/mock-data";
import {
  Pause,
  Play,
  XCircle,
  AlertTriangle,
  Loader2,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  X
} from "lucide-react";
import { useRouter } from "next/navigation";

const CANCELLATION_REASONS = [
  "Pricing is too expensive",
  "Missing critical features I need",
  "Technical issues or bug friction",
  "No longer require this service",
  "Switching to a different provider",
  "Other"
];

export default function SettingsPage() {
  const router = useRouter();
  const [state, setState] = useState(loadPortalState());
  const [actionLoading, setActionLoading] = useState<"pause" | "resume" | "cancel" | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscription = state.subscription;
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

      {/* Subscription Lifecycle panel */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm space-y-6">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-850">
            <div>
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">Subscription Status Management</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Control plan renewals, pausing, and service closures.</p>
            </div>
            <StatusBadge status={subscription.status} />
          </div>
        </div>

        {/* Status description */}
        <div className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 font-medium">
          {subscription.status === "active" && (
            <p>
              Your subscription is currently <strong className="text-zinc-900 dark:text-zinc-100">Active</strong> on the <strong className="text-indigo-600 dark:text-indigo-400">{currentPlan.name}</strong> tier. You will be billed automatically next on <strong className="text-zinc-900 dark:text-zinc-100">{subscription.nextBillingDate}</strong>.
            </p>
          )}
          {subscription.status === "past_due" && (
            <p className="text-red-600 dark:text-red-400 font-bold">
              Your subscription is currently in Dunning / Past Due state because automatic card charging failed. You must settle this invoice via bank transfer or update your card.
            </p>
          )}
          {subscription.status === "paused" && (
            <p>
              Your subscription billing is currently <strong className="text-zinc-900 dark:text-zinc-100">Paused</strong>. Service access is frozen, and auto-renew invoices will not be generated until you resume subscription.
            </p>
          )}
          {subscription.status === "cancelled" && (
            <p>
              Your subscription has been <strong className="text-zinc-900 dark:text-zinc-100">Cancelled</strong>. Future renewals are terminated, and service access is closed.
            </p>
          )}
        </div>

        {/* Actions grid */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-850">
          
          {/* Pause Action */}
          {(subscription.status === "active" || subscription.status === "past_due") && (
            <button
              onClick={handlePause}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors disabled:opacity-50"
            >
              {actionLoading === "pause" ? (
                <><Loader2 className="size-3.5 animate-spin" /> Pausing...</>
              ) : (
                <><Pause className="size-3.5" /> Pause Subscription</>
              )}
            </button>
          )}

          {/* Resume Action */}
          {subscription.status === "paused" && (
            <button
              onClick={handleResume}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {actionLoading === "resume" ? (
                <><Loader2 className="size-3.5 animate-spin" /> Resuming...</>
              ) : (
                <><Play className="size-3.5" /> Resume Subscription</>
              )}
            </button>
          )}

          {/* Cancel Action */}
          {subscription.status !== "cancelled" && (
            <button
              onClick={handleCancelClick}
              disabled={actionLoading !== null}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 transition-colors disabled:opacity-50"
            >
              <XCircle className="size-3.5" />
              Cancel Subscription
            </button>
          )}

          {subscription.status === "cancelled" && (
            <div className="flex gap-2 p-3 rounded-lg bg-zinc-50 dark:bg-[#0c0c0e]/30 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 leading-normal font-semibold">
              <HelpCircle className="size-4 shrink-0 mt-0.5" />
              <span>
                To re-enable subscriptions, contact support or register a new card in the storefront checkouts.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cancellation Reason Picker Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-red-500/10 text-red-700 dark:text-red-400">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4" />
                <span className="text-sm font-bold">Cancel Subscription Feedback</span>
              </div>
              <button
                onClick={() => setCancelModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                We are sorry to see you go. Please tell us your primary reason for cancellation so we can improve the platform for other customers.
              </p>

              {/* Reasons options */}
              <div className="space-y-2">
                {CANCELLATION_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      selectedReason === reason
                        ? "border-red-600 bg-red-50/20 dark:border-red-500 dark:bg-red-950/20 text-zinc-900 dark:text-white"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 text-zinc-650 dark:text-zinc-350"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="accent-red-600"
                    />
                    {reason}
                  </label>
                ))}
              </div>

              {/* Other comments field */}
              {selectedReason === "Other" && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">Specify Details</label>
                  <textarea
                    rows={2}
                    value={otherDetails}
                    onChange={(e) => setOtherDetails(e.target.value)}
                    placeholder="Tell us what we could do better..."
                    className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-semibold outline-none focus:border-red-400 dark:focus:border-red-500 transition-colors resize-none"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex justify-end gap-3">
                <button
                  onClick={() => setCancelModalOpen(false)}
                  className="h-8 px-4 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={!selectedReason || (selectedReason === "Other" && !otherDetails)}
                  className="h-8 px-4 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
                >
                  Confirm Cancellation
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
