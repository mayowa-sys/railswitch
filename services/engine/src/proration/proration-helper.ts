import Decimal from "decimal.js";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { nextRetryAt } from "../rails/retry-timing.js";
import { CreditsTable } from "../schema/credits.schema.js";
import { InvoicesTable } from "../schema/invoices.schema.js";
import { PaymentMethodsTable } from "../schema/payment_methods.schema.js";
import { PlansTable } from "../schema/plans.schema.js";
import { SubscriptionsTable } from "../schema/subscriptions.schema.js";
import { DunningPolicy } from "../state-machines/subscription.js";
import { getNextBillingDate } from "../utils/interval_util.js";
import { BillingHelper} from "../workers/billing.worker.js";
import { BillingHandler } from "../rails/billing-handler.js";

export async function getRemainingCredits(subId: string, planId: string) {
  const [sub] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, subId));
  if (!sub) throw new Error("Subscription does not exist");
  const [plan] = await db
    .select()
    .from(PlansTable)
    .where(eq(PlansTable.id, planId));
  if (!plan) throw new Error("Plan does not exist");

  const daysRemaining = Math.ceil(
    (sub.current_period_end.getTime() - new Date().getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if(daysRemaining < 1) {
    throw new Error("Time left for this plan is insignificant");
  }


  const duration =
    (getNextBillingDate(
      new Date(),
      plan.interval,
      plan.interval_count,
    ).getTime() -
      new Date().getTime()) /
    (24 * 60 * 60 * 1000);
    
  const unusedCredits = daysRemaining * (plan.amount / duration);
  return unusedCredits;
}

/**
 * Applies available credits to reduce a charge amount.
 * Deducts credits from the charge and marks them as consumed.
 *
 * @param chargeAmount - The original charge amount
 * @param availableCredits - Array of credit records from the database
 * @returns Object containing netCharge (amount after credits) and consumedCredits (credit IDs used)
 */
export async function applyCreditsToCharge(
  chargeAmount: Decimal | number,
  availableCredits: Array<{
    id: string;
    amount: string;
    amount_consumed: string;
  }>,
) {
  const charge = new Decimal(chargeAmount);
  //   const consumedCredits: string[] = [];
  let remainingCharge = charge;

  for (const credit of availableCredits) {
    if (remainingCharge.isZero() || remainingCharge.isNegative()) {
      break;
    }

    const availableCredit = new Decimal(credit.amount).minus(
      credit.amount_consumed,
    );

    if (availableCredit.isPositive()) {
      const creditToApply = Decimal.min(availableCredit, remainingCharge);

      // increase amount_consumed
      await db
        .update(CreditsTable)
        .set({
          amount_consumed: new Decimal(credit.amount_consumed)
            .plus(creditToApply)
            .toString(),
        })
        .where(eq(CreditsTable.id, credit.id));

      remainingCharge = remainingCharge.minus(creditToApply);
      //   consumedCredits.push(credit.id);
    }
  }

  return {
    netCharge: remainingCharge.toNumber(),
    // consumedCredits,
    creditApplied: charge.minus(remainingCharge).toNumber(),
  };
}

async function getDefaultPaymentMethod(customerId: string) {
  const [defaultMethod] = await db
    .select()
    .from(PaymentMethodsTable)
    .where(
      and(
        eq(PaymentMethodsTable.customer_id, customerId),
        eq(PaymentMethodsTable.is_default, true),
      ),
    );
  return defaultMethod ?? null;
}

export async function getSubscription(subId: string) {
  const [sub] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, subId));
  if (!sub) throw new Error("Subscription not found");
  return sub;
}

async function handleFailedPlanChangeCharge(subId: string, invoiceId: string) {
  const [subscription] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, subId));

  if (!subscription) return;

  const shouldRetry = subscription.retry_count < subscription.policy.maxRetries;

  // Use retry timing engine for smart scheduling
  const nextAttempt = nextRetryAt({
    currentTime: new Date(),
    retryCount: subscription.retry_count,
    policy: subscription.policy as DunningPolicy,
  });

  await db
    .update(InvoicesTable)
    .set({
      status: shouldRetry ? "pending_retry" : "uncollectible",
      next_attempt_at: nextAttempt,
    })
    .where(eq(InvoicesTable.id, invoiceId));
}

export async function handlePayments(
  subId: string,
  invoiceId: string,
  charge: number,
  billingHandler: BillingHandler,
  idempotencyKey: string,
) {
  const sub = await getSubscription(subId);
  try {
    const defaultPaymentMethod = await getDefaultPaymentMethod(sub.customer_id);
    if (!defaultPaymentMethod) {
      // No payment method — invoice stays open, cascade will handle later
      return;
    }

    const billResult = await billingHandler.bill({
      subscriptionId: subId,
      invoiceId,
      amount: charge,
      paymentMethodToken: defaultPaymentMethod.nomba_token,
      idempotencyKey: `${idempotencyKey}:proration`,
    });

    if (billResult.status === "paid") {
      await BillingHelper.markInvoiceAsPaid(invoiceId, `${charge}`);
    } else if (billResult.status === "failed") {
      await handleFailedPlanChangeCharge(sub.id, invoiceId);
    }
  } catch {
    // No default payment method — invoice is created but charge not attempted.
    // Cascade retry will pick this up when a payment method is added.
  }
}