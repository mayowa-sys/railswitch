import { getNextBillingDate } from "../utils/interval_util";
import { loadPlanChangeInputs, estimateCreditApplication } from "../proration/plan-change";
import { type Plan } from "../schema/plans.schema";

interface LineItems {
    plan_name: string;
    plan_amount: number;
    plan_interval: string;
    plan_ends_at: Date;
}

interface InvoicePreview {
    immediate_charge: number;
    credit_applied: number;
    next_invoice_amount: number;
    invoice_date: Date;
    items: LineItems[];
}

export async function preview(subId: string, change: Plan): Promise<InvoicePreview> {
  const inputs = await loadPlanChangeInputs(subId, change.id, change.id);
  const currentPlanId = inputs.subscription.plan_id;
  const updatedInputs = await loadPlanChangeInputs(subId, currentPlanId, change.id);

  let amountToCharge = 0;
  let creditApplied = updatedInputs.unusedCredits;

  if (inputs.totalCharge <= 0) {
    creditApplied += inputs.totalCharge;
  } else if (inputs.availableCredits.length > 0) {
    const result = estimateCreditApplication(
      inputs.totalCharge,
      inputs.availableCredits,
    );
    amountToCharge = result.netCharge;
    creditApplied += result.creditApplied;
  }

  return {
    immediate_charge: amountToCharge,
    credit_applied: creditApplied,
    next_invoice_amount: change.amount,
    invoice_date: new Date(),
    items: [
      {
        plan_name: change.name,
        plan_amount: Number(change.amount),
        plan_interval: change.interval,
        plan_ends_at: getNextBillingDate(
          new Date(),
          change.interval,
          change.interval_count,
        ),
      },
    ],
  };
}
