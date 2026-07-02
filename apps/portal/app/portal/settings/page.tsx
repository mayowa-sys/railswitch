"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusManagement } from "@/components/portal/settings/status-management";
import { CancelModal } from "@/components/portal/settings/cancel-modal";
import { api, type GatewaySubscription, type GatewayPlan } from "@/lib/api-client";
import { CheckCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [subscription, setSubscription] = useState<GatewaySubscription | null>(null);
  const [plans, setPlans] = useState<GatewayPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<"pause" | "resume" | "cancel" | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [otherDetails, setOtherDetails] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSub = () => {
    Promise.all([api.subscriptions.list(), api.plans.list()])
      .then(([subs, plansData]) => { const s = Array.isArray(subs) ? (subs.length > 0 ? subs[0] : null) : subs; setSubscription(s); setPlans(plansData); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchSub(); }, []);

  const handlePause = async () => {
    setActionLoading("pause");
    try { if (!subscription) return; await api.subscriptions.pause(subscription.id); setSuccessMsg("Subscription paused."); fetchSub(); }
    catch { setSuccessMsg("Failed to pause."); }
    setActionLoading(null);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleResume = async () => {
    setActionLoading("resume");
    try { if (!subscription) return; await api.subscriptions.resume(subscription.id); setSuccessMsg("Subscription resumed."); fetchSub(); }
    catch { setSuccessMsg("Failed to resume."); }
    setActionLoading(null);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  const handleConfirmCancel = async () => {
    if (!selectedReason) return;
    setActionLoading("cancel");
    setCancelModalOpen(false);
    try { if (!subscription) return; await api.subscriptions.cancel(subscription.id); setSuccessMsg("Subscription cancelled."); fetchSub(); }
    catch { setSuccessMsg("Failed to cancel."); }
    setActionLoading(null);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="size-5 animate-spin text-zinc-400" /></div>;
  if (!subscription) return <div className="py-12 text-center"><p className="text-sm text-zinc-500">No subscription found</p></div>;

  const plan = plans.find((p) => p.id === subscription.plan_id);
  const nextBilling = new Date(subscription.current_period_end).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader title="Portal Settings" description="Manage your subscription lifecycle." />
      {successMsg && <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2"><CheckCircle className="size-4" />{successMsg}</div>}
      <StatusManagement subscriptionStatus={subscription.state} currentPlan={{ id: plan?.id ?? "", name: plan?.name ?? "Unknown", price: Number(plan?.amount ?? 0), interval: (plan?.interval === "annual" ? "annually" : "monthly") as "monthly" | "annually", description: plan?.description ?? "" }} nextBillingDate={nextBilling} actionLoading={actionLoading} onPause={handlePause} onResume={handleResume} onCancelClick={() => { setSelectedReason(""); setOtherDetails(""); setCancelModalOpen(true); }} />
      <CancelModal open={cancelModalOpen} onOpenChange={setCancelModalOpen} selectedReason={selectedReason} onSelectReason={setSelectedReason} otherDetails={otherDetails} onOtherDetailsChange={setOtherDetails} onConfirm={handleConfirmCancel} applying={actionLoading === "cancel"} />
    </div>
  );
}
