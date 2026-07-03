import { Router, type Request, type Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { PaymentMethodsTable } from '../schema/payment_methods.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { AuditLog } from '../schema/audit_log.schema.js';
import { ProcessedEventsTable } from '../schema/processed_events.schema.js';
import { CreditsTable } from '../schema/credits.schema.js';

export const cleanupRouter = Router();

cleanupRouter.post('/playground', async (req: Request, res: Response) => {
  try {
    const { customer_id, plan_id, subscription_id } = req.body;
    
    if (!customer_id || !plan_id || !subscription_id) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'customer_id, plan_id, and subscription_id are required' } });
      return;
    }

    await db.execute(sql`SET LOCAL app.current_merchant_id = ${req.merchantId}`);

    // Verify all belong to this merchant
    const [sub] = await db.select().from(SubscriptionsTable).where(
      and(eq(SubscriptionsTable.id, subscription_id), eq(SubscriptionsTable.merchant_id, req.merchantId))
    ).limit(1);
    
    if (!sub) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

    // Delete in FK-safe order
    await db.delete(CreditsTable).where(eq(CreditsTable.subscription_id, subscription_id));
    await db.delete(AuditLog).where(eq(AuditLog.subscription_id, subscription_id));
    await db.delete(ProcessedEventsTable).where(eq(ProcessedEventsTable.subscription_id, subscription_id));
    await db.update(SubscriptionsTable).set({ current_invoice_id: null }).where(eq(SubscriptionsTable.id, subscription_id));
    await db.delete(InvoicesTable).where(eq(InvoicesTable.subscription_id, subscription_id));
    await db.delete(SubscriptionsTable).where(eq(SubscriptionsTable.id, subscription_id));
    await db.delete(PaymentMethodsTable).where(eq(PaymentMethodsTable.customer_id, customer_id));
    await db.delete(PlansTable).where(and(eq(PlansTable.id, plan_id), eq(PlansTable.merchant_id, req.merchantId)));
    await db.delete(CustomersTable).where(and(eq(CustomersTable.id, customer_id), eq(CustomersTable.merchant_id, req.merchantId)));

    res.json({ cleaned: true, subscription_id, plan_id, customer_id });
  } catch (err) {
    console.error('[cleanup] error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Cleanup failed' } });
  }
});
