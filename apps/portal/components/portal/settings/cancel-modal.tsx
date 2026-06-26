"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button"
import { AlertTriangle, X } from "lucide-react";

const CANCELLATION_REASONS = [
  "Pricing is too expensive",
  "Missing critical features I need",
  "Technical issues or bug friction",
  "No longer require this service",
  "Switching to a different provider",
  "Other"
];

interface CancelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedReason: string;
  onSelectReason: (reason: string) => void;
  otherDetails: string;
  onOtherDetailsChange: (details: string) => void;
  onConfirm: () => void;
  applying: boolean;
}

export function CancelModal({
  open,
  onOpenChange,
  selectedReason,
  onSelectReason,
  otherDetails,
  onOtherDetailsChange,
  onConfirm,
  applying,
}: CancelModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!applying}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <DialogTitle>Cancel Subscription Feedback</DialogTitle>
          </div>
          <DialogDescription>
            We are sorry to see you go. Please tell us your primary reason for cancellation so we can improve the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Reasons options */}
          <div className="space-y-2">
            {CANCELLATION_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${selectedReason === reason
                  ? "border-red-600 bg-red-50/20 dark:border-red-500 dark:bg-red-950/20 text-zinc-900 dark:text-white"
                  : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 text-zinc-650 dark:text-zinc-350"
                  }`}
              >
                <input
                  type="radio"
                  name="cancel_reason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={() => onSelectReason(reason)}
                  className="sr-only"
                />
                <div className={`size-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all duration-200 ${
                  selectedReason === reason
                    ? "border-red-600 dark:border-red-500 bg-red-600/10 dark:bg-red-500/10"
                    : "border-zinc-300 dark:border-zinc-700 bg-transparent"
                }`}>
                  {selectedReason === reason && (
                    <span className="size-1.5 rounded-full bg-red-600 dark:bg-red-500 animate-in zoom-in-50 duration-200" />
                  )}
                </div>
                {reason}
              </label>
            ))}
          </div>

          {/* Other comments field */}
          {selectedReason === "Other" && (
            <div className="space-y-1.5 animate-in fade-in duration-200">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Specify Details</label>
              <textarea
                rows={2}
                value={otherDetails}
                onChange={(e) => onOtherDetailsChange(e.target.value)}
                placeholder="Tell us what we could do better..."
                className="w-full p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-xs font-semibold outline-none focus:border-red-400 dark:focus:border-red-500 transition-colors resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-colors border border-zinc-200 dark:border-zinc-800"
          >
            Keep Subscription
          </button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!selectedReason || (selectedReason === "Other" && !otherDetails)}
          >
            Confirm Cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
