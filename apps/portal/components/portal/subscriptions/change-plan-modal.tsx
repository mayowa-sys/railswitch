"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { formatNaira, PLANS, type Plan } from "@/lib/mock-data";
import { AlertCircle, CheckCircle, Loader2, TrendingUp } from "lucide-react";

interface ChangePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: Plan;
  selectedPlanId: string;
  onSelectPlan: (planId: string) => void;
  previewLoading: boolean;
  previewData: any;
  applying: boolean;
  success: boolean;
  onConfirm: () => void;
}

export function ChangePlanModal({
  open,
  onOpenChange,
  currentPlan,
  selectedPlanId,
  onSelectPlan,
  previewLoading,
  previewData,
  applying,
  success,
  onConfirm,
}: ChangePlanModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!applying}>
        <DialogHeader>
          <DialogTitle>Change Subscription Plan</DialogTitle>
          <DialogDescription>
            Upgrade or downgrade your current service plan. Proration calculations are updated in real-time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 my-2">
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
                      onClick={() => onSelectPlan(plan.id)}
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
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#0c0c0e]/30 p-4 space-y-3.5 animate-in fade-in duration-200">
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
            </>
          )}
        </div>

        {!success && (
          <DialogFooter>
            <button
              onClick={() => onOpenChange(false)}
              disabled={applying}
              className="h-9 px-4 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={applying || selectedPlanId === currentPlan.id || !previewData}
              className="h-9 px-5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              {applying ? (
                <><Loader2 className="size-3.5 animate-spin" /> Committing Changes...</>
              ) : (
                "Confirm Plan Change"
              )}
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
