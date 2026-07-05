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

const TEST_PLANS = ['plan_vNJk8S0sA6', 'plan_TgRG4fWqM7', 'plan_u2msPWSpEV'];

cleanupRouter.post('/bulk', async (req: Request, res: Response) => {
  const merchantId = req.merchantId!;
  const safe = async (label: string, fn: () => Promise<any>) => {
    try { return await fn(); } catch (e: any) { console.warn(`[cleanup] skip ${label}:`, e.message?.slice(0, 120)); return null; }
  };

  try {
    await db.execute(sql`SELECT set_config('app.current_merchant_id', ${merchantId}, true)`);

    // Find test customers
    const custResult = await db.execute(sql`
      SELECT id FROM customers 
      WHERE merchant_id = ${merchantId}
        AND (email LIKE '%playground.dev%' OR email LIKE '%test_%@%' 
             OR email IN ('livetest@email.com','decline@email.com','judge@demo.com')
             OR email LIKE '%demo.test')
    `);
    const custIds: string[] = (custResult.rows as any[]).map(r => r.id);

    // Find test subs
    const subResult = await db.execute(sql`
      SELECT id FROM subscriptions 
      WHERE merchant_id = ${merchantId}
        AND plan_id IN ('plan_vNJk8S0sA6','plan_TgRG4fWqM7','plan_u2msPWSpEV')
    `);
    const subIds: string[] = (subResult.rows as any[]).map(r => r.id);

    // Also find subs from test customers
    if (custIds.length > 0) {
      const cs = await db.execute(sql`SELECT id FROM subscriptions WHERE merchant_id = ${merchantId} AND customer_id IN (${sql.join(custIds.map(id => sql`${id}`), sql`, `)})`);
      for (const r of (cs.rows as any[])) { if (!subIds.includes(r.id)) subIds.push(r.id); }
    }

    console.log(`[cleanup] Found ${custIds.length} test customers, ${subIds.length} test subs`);

    // Delete each sub's children individually (no transaction — each is independent)
    for (const subId of subIds) {
      await safe('credits', () => db.execute(sql`DELETE FROM credits WHERE subscription_id = ${subId} AND merchant_id = ${merchantId}`));
      await safe('processed_events', () => db.execute(sql`DELETE FROM processed_events WHERE subscription_id = ${subId}`));
      await safe('null_invoice', () => db.execute(sql`UPDATE subscriptions SET current_invoice_id = NULL WHERE id = ${subId} AND merchant_id = ${merchantId}`));
      await safe('invoices', () => db.execute(sql`DELETE FROM invoices WHERE subscription_id = ${subId} AND merchant_id = ${merchantId}`));
      await safe('sub', () => db.execute(sql`DELETE FROM subscriptions WHERE id = ${subId} AND merchant_id = ${merchantId}`));
    }

    // Delete test customers and payment methods
    if (custIds.length > 0) {
      const joined = sql.join(custIds.map(id => sql`${id}`), sql`, `);
      await safe('pm', () => db.execute(sql`DELETE FROM payment_methods WHERE customer_id IN (${joined}) AND merchant_id = ${merchantId}`));
      await safe('cust-invoices', () => db.execute(sql`DELETE FROM invoices WHERE customer_id IN (${joined}) AND merchant_id = ${merchantId}`));
      await safe('customers', () => db.execute(sql`DELETE FROM customers WHERE id IN (${joined}) AND merchant_id = ${merchantId}`));
    }

    // Hard-delete test plans (set RLS context first)
    await db.execute(sql`SELECT set_config('app.current_merchant_id', ${merchantId}, true)`);
    for (const planId of TEST_PLANS) {
      await safe(`plan:${planId}`, () => db.execute(sql`DELETE FROM plans WHERE id = ${planId} AND merchant_id = ${merchantId}`));
    }

    // Counts
    const counts = await db.execute(sql`
      SELECT 
        (SELECT count(*) FROM plans WHERE merchant_id = ${merchantId}) as plans,
        (SELECT count(*) FROM customers WHERE merchant_id = ${merchantId}) as customers,
        (SELECT count(*) FROM subscriptions WHERE merchant_id = ${merchantId}) as subscriptions,
        (SELECT count(*) FROM invoices WHERE merchant_id = ${merchantId}) as invoices
    `);

    res.json({ cleaned: true, removed: { customers: custIds.length, subscriptions: subIds.length }, remaining: counts.rows[0] });
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
