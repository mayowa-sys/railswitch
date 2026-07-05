import { Router, type Request, type Response } from 'express';
import { eq, and, sql, like, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { PlansTable } from '../schema/plans.schema.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { PaymentMethodsTable } from '../schema/payment_methods.schema.js';
import { InvoicesTable } from '../schema/invoices.schema.js';

export const cleanupRouter = Router();

// Patterns that identify test/playground data
const TEST_EMAIL_PATTERNS = [
  'test_%@playground.dev',
  'webhook_test%@demo.dev',
  'cascade_test%@demo.dev',
  '%_test@demo.dev',
  'livetest@email.com',
  'judge@demo.com',
  'decline@email.com',
  'demo@video.test',
  'final@demo.test',
  'testing@email.com',
];

const TEST_PLAN_PATTERNS = [
  'Test %',
  'Cascade Plan',
  'Playground test plan',
];

function buildEmailFilter(merchantId: string) {
  const conditions = TEST_EMAIL_PATTERNS.map(p => like(CustomersTable.email, p));
  return sql`(${CustomersTable.merchant_id} = ${merchantId}) AND (${sql.join(conditions, sql` OR `)})`;
}

function buildPlanFilter(merchantId: string) {
  const conditions = TEST_PLAN_PATTERNS.map(p => like(PlansTable.name, p));
  return sql`(${PlansTable.merchant_id} = ${merchantId}) AND (${sql.join(conditions, sql` OR `)})`;
}

cleanupRouter.post('/bulk', async (req: Request, res: Response) => {
  const merchantId = req.merchantId!;

  try {
    // Soft-delete: rename test records so they don't show in the UI
    // 1. Soft-delete test customers (rename email)
    const testCustomers = await db.select({ id: CustomersTable.id, email: CustomersTable.email })
      .from(CustomersTable)
      .where(buildEmailFilter(merchantId));

    let hiddenCustomers = 0;
    for (const c of testCustomers) {
      if (!c.email.startsWith('[deleted]')) {
        await db.update(CustomersTable)
          .set({ email: `[deleted]_${c.email}`, name: `[deleted] ${(c as any).name || ''}` })
          .where(eq(CustomersTable.id, c.id));
        hiddenCustomers++;
      }
    }

    // 2. Soft-delete test plans (rename)
    const testPlans = await db.select({ id: PlansTable.id, name: PlansTable.name })
      .from(PlansTable)
      .where(buildPlanFilter(merchantId));

    let hiddenPlans = 0;
    for (const p of testPlans) {
      if (!p.name.startsWith('[deleted]')) {
        await db.update(PlansTable)
          .set({ name: `[deleted] ${p.name}` })
          .where(eq(PlansTable.id, p.id));
        hiddenPlans++;
      }
    }

    // 3. Also catch any test_*@playground.dev customers we might have missed
    const extraTestCustomers = await db.select({ id: CustomersTable.id })
      .from(CustomersTable)
      .where(sql`${CustomersTable.merchant_id} = ${merchantId} AND ${CustomersTable.email} LIKE 'test_%'`);

    for (const c of extraTestCustomers) {
      const [cust] = await db.select({ email: CustomersTable.email }).from(CustomersTable).where(eq(CustomersTable.id, c.id)).limit(1);
      if (cust && !cust.email.startsWith('[deleted]')) {
        await db.update(CustomersTable)
          .set({ email: `[deleted]_${cust.email}` })
          .where(eq(CustomersTable.id, c.id));
        hiddenCustomers++;
      }
    }

    res.json({ cleaned: true, hidden: { customers: hiddenCustomers, plans: hiddenPlans } });
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

    // Soft-delete: rename customer email and plan name
    await db.update(CustomersTable)
      .set({ email: `[deleted]_${customer_id}@playground.dev`, name: '[deleted] Playground Test' })
      .where(and(eq(CustomersTable.id, customer_id), eq(CustomersTable.merchant_id, req.merchantId)));

    await db.update(PlansTable)
      .set({ name: `[deleted] ${plan_id}` })
      .where(and(eq(PlansTable.id, plan_id), eq(PlansTable.merchant_id, req.merchantId)));

    // Hard-delete the subscription + children (no FK issues since we skip audit_log)
    try {
      await db.execute(sql`DELETE FROM processed_events WHERE subscription_id = ${subscription_id}`);
      await db.execute(sql`UPDATE subscriptions SET current_invoice_id = NULL WHERE id = ${subscription_id} AND merchant_id = ${req.merchantId}`);
      await db.execute(sql`DELETE FROM invoices WHERE subscription_id = ${subscription_id} AND merchant_id = ${req.merchantId}`);
      await db.execute(sql`DELETE FROM subscriptions WHERE id = ${subscription_id} AND merchant_id = ${req.merchantId}`);
      await db.execute(sql`DELETE FROM payment_methods WHERE customer_id = ${customer_id} AND merchant_id = ${req.merchantId}`);
    } catch (subErr) {
      // If hard-delete fails, soft-delete is enough
      console.warn('[playground] sub hard-delete failed, soft-delete is sufficient:', subErr);
    }

    res.json({ cleaned: true, subscription_id, plan_id, customer_id });
  } catch (err) {
    console.error('[cleanup] error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Cleanup failed' } });
  }
});
