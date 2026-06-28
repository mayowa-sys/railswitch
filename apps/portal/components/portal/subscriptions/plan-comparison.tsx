import { Card } from "@/components/ui/card";
import { formatNaira, PLANS, type Plan } from "@/lib/mock-data";

interface PlanComparisonProps {
  currentPlan: Plan;
}

export function PlanComparison({ currentPlan }: PlanComparisonProps) {
  return (
    <Card className="p-6 shadow-sm">
      <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
        Available Tiers Comparison
      </h4>
      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 flex flex-col justify-between ${
                isCurrent
                  ? "border-indigo-600 bg-indigo-50/20 dark:border-indigo-500 dark:bg-indigo-950/10"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-white">{plan.name}</p>
                  {isCurrent && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Current</span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">{plan.description}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60 flex items-baseline gap-1">
                <span className="text-base font-black text-zinc-900 dark:text-white">{formatNaira(plan.price)}</span>
                <span className="text-[10px] text-zinc-500">/mo</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
