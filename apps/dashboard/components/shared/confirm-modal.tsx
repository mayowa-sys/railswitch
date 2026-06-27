"use client";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  variant?: "destructive" | "warning";
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  onConfirm,
  loading = false,
  variant = "destructive",
}: ConfirmModalProps) {
  const iconColor =
    variant === "destructive"
      ? "text-red-500 bg-red-50 dark:bg-red-950/40"
      : "text-amber-500 bg-amber-50 dark:bg-amber-950/40";

  const confirmClass =
    variant === "destructive"
      ? "bg-red-600 hover:bg-red-700 text-white border-0"
      : "bg-amber-500 hover:bg-amber-600 text-white border-0";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className={confirmClass}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${iconColor}`}>
          <AlertTriangle className="size-5" />
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1">
          {body}
        </p>
      </div>
    </Modal>
  );
}
