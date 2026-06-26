import { Job, Worker } from "bullmq";
import { BillingHandler } from "../rails/billing-handler";
import { billingHandler, BillingsQueue } from "../queues/billings.queue";
import { GlobalLogger } from "../utils/logger";
import { db } from "../db/client";
import { SubscriptionsTable } from "../schema/subscriptions.schema";
import { lte, sql, eq, and } from "drizzle-orm";
import { Plan, PlansTable } from "../schema/plans.schema";
import { PaymentMethodsTable } from "../schema/payment_methods.schema";
import { InvoicesTable } from "../schema/invoices.schema";
import { getNextBillingDate } from "../utils/interval_util";

interface ChargeSubscriptionData {
  subscriptionId: string;
  customerId: string;
  planId: string;
  idemKey: string;
  merchantId: string;
}

class BillingHelper {
  async getPendingSubscriptions() {
    return db
      .select()
      .from(SubscriptionsTable)
      .where(lte(SubscriptionsTable.next_billing_at, sql`now`));
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
}

class BillingService {
  constructor(
    private billingHelper: BillingHelper,
    private billingHandler: BillingHandler,
    private logger: GlobalLogger,
  ) {}

  private buildChargeData(
    sub: typeof SubscriptionsTable.$inferSelect,
  ): ChargeSubscriptionData {
    return {
      subscriptionId: sub.id,
      customerId: sub.customer_id,
      planId: sub.customer_id,
      idemKey: "idemKey",
      merchantId: sub.merchant_id,
    };
  }

  async pollForPendingSubscriptions() {
    this.logger.info("Starting Poll..");
    const subscriptions = await this.billingHelper.getPendingSubscriptions();

    const jobs = await Promise.allSettled(
      subscriptions.map((sub) => {
        return BillingsQueue.add("charge", this.buildChargeData(sub), {
          delay: 2000,
        });
      }),
    );

    jobs.forEach((result, index) => {
      if (result.status === "rejected") {
        this.logger.error(
          `Failed to queue subscription ${subscriptions[index].id}`,
        );
      }
    });
  }

  async processCharge(data: ChargeSubscriptionData) {
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

    const result = await this.billingHandler.bill({
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

  private async handleSuccessfulPayment(
    subscriptionId: string,
    invoiceId: string,
    plan: Plan,
  ) {
    // Mark invoice as paid
    await this.billingHelper.markInvoiceAsPaid(invoiceId, `${plan.amount}`);

    // Schedule next billing
    const nextBillingDate = this.calculateNextBillingDate(plan);
    await this.billingHelper.updateSubscriptionNextBillingDate(
      subscriptionId,
      nextBillingDate,
    );
  }

  private async handleFailedPayment(subId: string, invoiceId: string) {
    const subscriptions = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, subId));

    const shouldRetry =
      subscriptions[0].retry_count < subscriptions[0].policy.maxRetries;

    // set the date of the date of the next billing to 3 days for now until you start the dunning policy
    await db
      .update(InvoicesTable)
      .set({
        status: `${shouldRetry ? "pending_retry" : "uncollectible"}`,
        next_attempt_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      })
      .where(eq(InvoicesTable.id, invoiceId));

    await db
      .update(SubscriptionsTable)
      .set({ next_billing_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) })
      .where(eq(SubscriptionsTable.id, subId));
  }

  private calculateNextBillingDate(plan: Plan): Date {
    // Use your existing logic or refactor it
    return getNextBillingDate(new Date(), plan.interval, plan.interval_count);
  }
}

export const BillingWorker = new Worker("billings", async (job: Job) => {
  const logger = new GlobalLogger("Billing Worker");
  const billingService = new BillingService(
    new BillingHelper(),
    billingHandler,
    logger,
  );

  try {
    switch (job.name) {
      case "poll_subscriptions":
        await billingService.pollForPendingSubscriptions();
      case "charge":
        await billingService.processCharge(job.data);
      default:
        throw new Error(`Unknown Job : ${job.name}`);
    }
  } catch (err) {
    logger.error(`Job Failed: ${job.name}`, err);
    throw err;
  }
});
