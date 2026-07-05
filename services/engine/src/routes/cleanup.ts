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

cleanupRouter.post('/bulk', async (req: Request, res: Response) => {
  const merchantId = req.merchantId!;

  try {
    // Use a transaction so set_config persists across all queries
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.current_merchant_id', ${merchantId}, true)`);

      // Find test customers (playground + manual test accounts, NOT the 285 seed users)
      const custResult = await tx.execute(sql`
        SELECT id FROM customers 
        WHERE merchant_id = ${merchantId}
          AND (email IN ('livetest@email.com', 'judge@demo.com', 'decline@email.com', 
                         'demo@video.test', 'final@demo.test', 'testing@email.com')
               OR email LIKE 'test_%@playground.dev')
      `);
      const custIds: string[] = (custResult.rows as any[]).map(r => r.id);

      if (custIds.length === 0) {
        return { removed: { customers: 0, subscriptions: 0 }, remaining: null };
      }

      // Find their subscriptions
      const subResult = await tx.execute(sql`
        SELECT id FROM subscriptions WHERE merchant_id = ${merchantId} AND customer_id IN (${sql.join(custIds.map(id => sql`${id}`), sql`, `)})
      `);
      const subIds: string[] = (subResult.rows as any[]).map(r => r.id);

      // Delete FK-safe: children first
      for (const subId of subIds) {
        // Skip credits and audit_log — RLS policies block deletes
        await tx.execute(sql`DELETE FROM processed_events WHERE subscription_id = ${subId}`);
        await tx.execute(sql`UPDATE subscriptions SET current_invoice_id = NULL WHERE id = ${subId} AND merchant_id = ${merchantId}`);
        await tx.execute(sql`DELETE FROM invoices WHERE subscription_id = ${subId} AND merchant_id = ${merchantId}`);
        await tx.execute(sql`DELETE FROM subscriptions WHERE id = ${subId} AND merchant_id = ${merchantId}`);
      }

      // Delete payment methods and invoices by customer_id, then customers
      const joined = sql.join(custIds.map(id => sql`${id}`), sql`, `);
      await tx.execute(sql`DELETE FROM payment_methods WHERE customer_id IN (${joined}) AND merchant_id = ${merchantId}`);
      await tx.execute(sql`DELETE FROM invoices WHERE customer_id IN (${joined}) AND merchant_id = ${merchantId}`);
      await tx.execute(sql`DELETE FROM customers WHERE id IN (${joined}) AND merchant_id = ${merchantId}`);

      // Final counts
      const counts = await tx.execute(sql`
        SELECT 
          (SELECT count(*) FROM plans WHERE merchant_id = ${merchantId}) as plans,
          (SELECT count(*) FROM customers WHERE merchant_id = ${merchantId}) as customers,
          (SELECT count(*) FROM subscriptions WHERE merchant_id = ${merchantId}) as subscriptions,
          (SELECT count(*) FROM invoices WHERE merchant_id = ${merchantId}) as invoices
      `);

      return {
        removed: { customers: custIds.length, subscriptions: subIds.length },
        remaining: counts.rows[0],
      };
    });

    res.json({ cleaned: true, ...result });
  } catch (err) {
    console.error('[cleanup-bulk] error:', err);
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: msg } });
  }
});

cleanupRouter.post('/playground', async (req: Request, res: Response) => {
  try {
    const { customer_id, plan_id, subscription_id } = req.body;

    if (!customer_id || !plan_id || !subscription_id) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'customer_id, plan_id, and subscription_id are required' } });
      return;
    }

    await db.execute(sql`SELECT set_config('app.current_merchant_id', ${req.merchantId}, true)`);

    const [sub] = await db.select().from(SubscriptionsTable).where(
      and(eq(SubscriptionsTable.id, subscription_id), eq(SubscriptionsTable.merchant_id, req.merchantId))
    ).limit(1);

    if (!sub) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subscription not found' } });
      return;
    }

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
