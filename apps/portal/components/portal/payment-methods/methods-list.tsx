import { Card } from "@/components/ui/card";
import { type PaymentMethod } from "@/lib/mock-data";
import { CreditCard, Check, Trash2 } from "lucide-react";

interface MethodsListProps {
  paymentMethods: PaymentMethod[];
  defaultMethodId: string;
  onSetDefault: (pmId: string) => void;
  onDeleteMethod: (pmId: string) => void;
}

export function MethodsList({
  paymentMethods,
  defaultMethodId,
  onSetDefault,
  onDeleteMethod,
}: MethodsListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {paymentMethods.map((method) => {
        const isDefault = method.id === defaultMethodId || method.isDefault;
        return (
          <Card
            key={method.id}
            className={`p-5 flex flex-col justify-between shadow-sm relative ${
              isDefault
                ? "border-indigo-600 dark:border-indigo-500 ring-1 ring-indigo-600 dark:ring-indigo-500"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
                  <CreditCard className="size-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {method.type === "card"
                      ? `${method.brand} ending in ${method.last4}`
                      : `${method.bankName} Account •••• ${method.last4}`}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {method.type === "card" ? "Tokenized Card Rail" : "Bank Transfer Gateway"}
                  </p>
                </div>
              </div>
              {isDefault && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/30">
                  <Check className="size-2.5" />
                  Default
                </span>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-zinc-100 dark:border-zinc-850 flex justify-between items-center text-xs">
              {!isDefault ? (
                <button
                  onClick={() => onSetDefault(method.id)}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-bold transition-all"
                >
                  Set as default
                </button>
              ) : (
                <span className="text-[10px] text-zinc-500 font-semibold italic">
                  Primary payment source
                </span>
              )}

              {!isDefault && (
                <button
                  onClick={() => onDeleteMethod(method.id)}
                  className="text-red-500 hover:text-red-700 transition-colors p-1"
                  title="Remove method"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
