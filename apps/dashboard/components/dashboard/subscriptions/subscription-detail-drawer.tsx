"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  CUSTOMERS,
  PLANS,
  formatNaira,
  type Subscription,
  type CascadeAttempt,
} from "@/lib/mock-data";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  CreditCard,
  RefreshCcw,
  Landmark,
  Hash,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

const CASCADE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  card:            { label: "Card charge",      icon: CreditCard },
  retry:           { label: "Smart retry",      icon: RefreshCcw },
  virtual_account: { label: "Virtual account",  icon: Landmark },
  ussd:            { label: "USSD prompt",       icon: Hash },
  whatsapp:        { label: "WhatsApp link",     icon: MessageCircle },
};

function CascadeTimeline({ history }: { history: CascadeAttempt[] }) {
  return (
    <ol className="space-y-3">
      {history.map((step, i) => {
        const meta = CASCADE_META[step.step];
        const Icon = meta?.icon ?? CreditCard;
        const StatusIcon =
          step.status === "success" ? CheckCircle2 :
          step.status === "pending" ? Clock : XCircle;
        const statusColor =
          step.status === "success" ? "text-emerald-500" :
          step.status === "pending" ? "text-amber-500" : "text-red-500";

        return (
          <li key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="size-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                <Icon className="size-3.5" />
              </div>
              {i < history.length - 1 && (
                <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
              )}
            </div>
            <div className="flex-1 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  {meta?.label}
                </span>
                <StatusIcon className={cn("size-3.5", statusColor)} />
              </div>
              {step.note && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{step.note}</p>
              )}
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                {new Date(step.attemptedAt).toLocaleString("en-NG")}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

interface SubscriptionDetailDrawerProps {
  subscription: Subscription | null;
  onClose: () => void;
}

export function SubscriptionDetailDrawer({ subscription, onClose }: SubscriptionDetailDrawerProps) {
  const customer = subscription ? CUSTOMERS.find((c) => c.id === subscription.customerId) : null;
  const plan = subscription ? PLANS.find((p) => p.id === subscription.planId) : null;

  return (
    <Sheet open={!!subscription} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto bg-white dark:bg-[#111113] border-l border-zinc-200 dark:border-zinc-800/80 p-0"
      >
        {subscription && (
          <>
            <SheetHeader className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Subscription detail
                  </SheetTitle>
                  <SheetDescription className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {subscription.id}
                  </SheetDescription>
                </div>
                <StatusBadge status={subscription.status} />
              </div>
            </SheetHeader>

            <div className="px-6 py-5 space-y-6">
              {/* Customer */}
              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                  Customer
                </h4>
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-gradient-to-tr from-indigo-100 to-violet-100 dark:from-indigo-950/60 dark:to-violet-950/60 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                    {customer?.name.split(" ").map((n) => n[0]).join("") ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{customer?.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{customer?.email}</p>
                  </div>
                  <Link
                    href={`/dashboard/customers/${customer?.id}`}
                    className="shrink-0 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                  >
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              </section>

              {/* Details */}
              <section>
                <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                  Details
                </h4>
                <dl className="space-y-2">
                  {[
                    { label: "Plan", value: plan?.name ?? "—" },
                    { label: "Amount", value: formatNaira(subscription.amount) },
                    { label: "Interval", value: plan?.interval ?? "—" },
                    {
                      label: "Started",
                      value: new Date(subscription.startedAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
                    },
                    {
                      label: "Next billing",
                      value: subscription.status === "cancelled" ? "—" : new Date(subscription.nextBillingDate).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                      <dd className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* Cascade history */}
              {subscription.cascadeHistory.length > 0 && (
                <section>
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                    Cascade history
                  </h4>
                  <CascadeTimeline history={subscription.cascadeHistory} />
                </section>
              )}

              {/* Billing history */}
              {subscription.billingHistory.length > 0 && (
                <section>
                  <h4 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                    Billing history
                  </h4>
                  <div className="space-y-2">
                    {subscription.billingHistory.map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0">
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{formatNaira(bill.amount)}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{bill.date} · via {CASCADE_META[bill.method]?.label ?? bill.method}</p>
                        </div>
                        <StatusBadge status={bill.status} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
