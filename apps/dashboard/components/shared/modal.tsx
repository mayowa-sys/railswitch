"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_MAP = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  size = "md",
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-11/12 md:w-full gap-0 p-0 overflow-hidden border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#111113] shadow-2xl rounded-2xl",
          SIZE_MAP[size],
          className
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
          <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="px-6 py-5">{children}</div>

        {footer && (
          <DialogFooter className="px-6 pb-6 pt-2 flex items-center justify-end gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
