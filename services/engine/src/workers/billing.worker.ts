import { Job, Worker } from "bullmq";
import { BillingHandler } from "../rails/billing-handler";
import { BillingsQueue } from "../queues/billings.queue";
import { GlobalLogger } from "../utils/logger";
import { db } from "../db/client";
import { SubscriptionsTable } from "../schema/subscriptions.schema";
import { lte, sql, eq, and } from "drizzle-orm";
import { Plan, PlansTable } from "../schema/plans.schema";
import { PaymentMethodsTable } from "../schema/payment_methods.schema";
import { InvoicesTable } from "../schema/invoices.schema";
import { getNextBillingDate } from "../utils/interval_util";
import { createBillingHandler } from "../rails/billing-handler-dependencies";
import { nextRetryAt } from "../rails/retry-timing";
import type { DunningPolicy } from "../state-machines/subscription";

interface ChargeSubscriptionData {
  subscriptionId: string;
  customerId: string;
  planId: string;
  idemKey: string;
  merchantId: string;
}

interface TrialConversionData {
  subscriptionId: string;
  customerId: string;
  planId: string;
  merchantId: string;
}

type BillingJobData = ChargeSubscriptionData | TrialConversionData;

class BillingHelper {
  async getPendingSubscriptions() {
    return db
      .select()
      .from(SubscriptionsTable)
      .where(lte(SubscriptionsTable.next_billing_at, sql`now()`));
  }

  async getEndingTrials() {
    return db
      .select()
      .from(SubscriptionsTable)
      .where(
        and(
          lte(SubscriptionsTable.trial_ends_at, sql`now()`),
          eq(SubscriptionsTable.state, "trialing"),
        ),
      );
  }

  async getPlanById(id: string) {
    const [plan] = await db
      .select()
      .from(PlansTable)
      .where(eq(PlansTable.id, id));
    if (!plan) throw new Error(`Plan not found ${id}`);
    return plan;
  }

  async getDefaultPaymentMethod(customerId: string) {
    const [defaultMethod] = await db
      .select()
      .from(PaymentMethodsTable)
      .where(
        and(
          eq(PaymentMethodsTable.customer_id, customerId),
          eq(PaymentMethodsTable.is_default, true),
        ),
      );
    if (!defaultMethod)
      throw new Error(
        `Default Payment Method for customer ${customerId} not found`,
      );
    return defaultMethod;
  }

  async markInvoiceAsPaid(invoiceId: string, amount: string) {
    await db
      .update(InvoicesTable)
      .set({
        status: "paid",
        amount_paid: amount,
        paid_at: new Date(),
      })
      .where(eq(InvoicesTable.id, invoiceId));
  }

  async updateSubscriptionNextBillingDate(
    subscriptionId: string,
    nextBillingDate: Date,
  ) {
    await db
      .update(SubscriptionsTable)
      .set({
        next_billing_at: nextBillingDate,
        retry_count: 0,
      })
      .where(eq(SubscriptionsTable.id, subscriptionId));
  }

  async updateSubscriptionState(subscriptionId: string, state: string) {
    await db
      .update(SubscriptionsTable)
      .set({ state: state as typeof SubscriptionsTable.$inferSelect["state"] })
      .where(eq(SubscriptionsTable.id, subscriptionId));
  }
}

function buildChargeData(
  sub: typeof SubscriptionsTable.$inferSelect,
): ChargeSubscriptionData {
  return {
    subscriptionId: sub.id,
    customerId: sub.customer_id,
    planId: sub.plan_id,
    idemKey: `billing:${sub.id}:${Date.now()}`,
    merchantId: sub.merchant_id,
  };
}

function buildTrialData(
  sub: typeof SubscriptionsTable.$inferSelect,
): TrialConversionData {
  return {
    subscriptionId: sub.id,
    customerId: sub.customer_id,
    planId: sub.plan_id,
    merchantId: sub.merchant_id,
  };
}

function isChargeData(data: BillingJobData): data is ChargeSubscriptionData {
  return "idemKey" in data;
}

class BillingService {
  constructor(
    private billingHelper: BillingHelper,
    private logger: GlobalLogger,
  ) {}

  async pollForPendingSubscriptions() {
    this.logger.info("Polling for due subscriptions...");
    const subscriptions = await this.billingHelper.getPendingSubscriptions();

    const jobs = await Promise.allSettled(
      subscriptions.map((sub) =>
        BillingsQueue.add("charge", buildChargeData(sub), { delay: 2000 }),
      ),
    );

    jobs.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.error(
          `Failed to queue subscription ${subscriptions[index].id}`,
        );
      }
    });
  }

  async pollForEndingTrials() {
    this.logger.info("Polling for ending trials...");
    const trials = await this.billingHelper.getEndingTrials();

    const jobs = await Promise.allSettled(
      trials.map((sub) =>
        BillingsQueue.add("trial_conversion", buildTrialData(sub), {
          delay: 1000,
        }),
      ),
    );

    jobs.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.error(
          `Failed to queue trial conversion ${trials[index].id}`,
        );
      }
    });
  }

  async processCharge(
    data: ChargeSubscriptionData,
    billingHandler: BillingHandler,
  ) {
    const plan = await this.billingHelper.getPlanById(data.planId);
    const defaultPaymentMethod =
      await this.billingHelper.getDefaultPaymentMethod(data.customerId);
    const [invoice] = await db
      .insert(InvoicesTable)
      .values({
        subscription_id: data.subscriptionId,
        merchant_id: data.merchantId,
        amount: `${plan.amount}`,
        due_date: new Date(),
      })
      .returning();
    if (!invoice)
      throw new Error(
        `Invoice for subscription ${data.subscriptionId} could not be made`,
      );

    const result = await billingHandler.bill({
      subscriptionId: data.subscriptionId,
      invoiceId: invoice.id,
      amount: plan.amount,
      paymentMethodToken: defaultPaymentMethod.nomba_token,
      idempotencyKey: data.idemKey,
    });

    if (result.status === "paid") {
      await this.handleSuccessfulPayment(data.subscriptionId, invoice.id, plan);
    } else {
      await this.handleFailedPayment(data.subscriptionId, invoice.id);
    }
  }

  async processTrialConversion(data: TrialConversionData) {
    const plan = await this.billingHelper.getPlanById(data.planId);
    const now = new Date();

    const [invoice] = await db
      .insert(InvoicesTable)
      .values({
        subscription_id: data.subscriptionId,
        merchant_id: data.merchantId,
        amount: `${plan.amount}`,
        currency: "NGN",
        description: `First invoice after trial — ${plan.name}`,
        due_date: now,
      })
      .returning();

    if (!invoice) {
      throw new Error(
        `Trial invoice for subscription ${data.subscriptionId} could not be created`,
      );
    }

    // Schedule first billing — same as a regular charge but marks trial end
    const nextDate = getNextBillingDate(now, plan.interval, plan.interval_count);
    await this.billingHelper.updateSubscriptionNextBillingDate(
      data.subscriptionId,
      nextDate,
    );

    this.logger.info("Trial converted to paid", {
      subscriptionId: data.subscriptionId,
      invoiceId: invoice.id,
      nextBilling: nextDate.toISOString(),
    });
  }

  private async handleSuccessfulPayment(
    subscriptionId: string,
    invoiceId: string,
    plan: Plan,
  ) {
    await this.billingHelper.markInvoiceAsPaid(invoiceId, `${plan.amount}`);

    const nextBillingDate = getNextBillingDate(
      new Date(),
      plan.interval,
      plan.interval_count,
    );
    await this.billingHelper.updateSubscriptionNextBillingDate(
      subscriptionId,
      nextBillingDate,
    );
  }

  private async handleFailedPayment(subId: string, invoiceId: string) {
    const [subscription] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, subId));

    if (!subscription) return;

    const shouldRetry =
      subscription.retry_count < subscription.policy.maxRetries;

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

    await db
      .update(SubscriptionsTable)
      .set({ next_billing_at: nextAttempt })
      .where(eq(SubscriptionsTable.id, subId));
  }
}

export const BillingWorker = new Worker(
  "billings",
  async (job: Job<BillingJobData>) => {
    const logger = new GlobalLogger("Billing Worker");
    const billingService = new BillingService(new BillingHelper(), logger);

    try {
      switch (job.name) {
        case "poll_subscriptions":
          await billingService.pollForPendingSubscriptions();
          await billingService.pollForEndingTrials();
          break;
        case "charge": {
          if (!isChargeData(job.data)) {
            throw new Error("Invalid charge job data");
          }
          const merchantId = job.data.merchantId;
          const billingHandler = createBillingHandler(merchantId);
          await billingService.processCharge(job.data, billingHandler);
          break;
        }
        case "trial_conversion": {
          const data = job.data as TrialConversionData;
          await billingService.processTrialConversion(data);
          break;
        }
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    } catch (err) {
      logger.error(`Job failed: ${job.name}`, err as Error);
      throw err;
    }
  },
  { connection: { url: process.env.REDIS_URL! } },
);
