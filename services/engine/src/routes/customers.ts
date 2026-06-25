import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { CustomersTable } from '../schema/customers.schema.js';
import type { Request, Response } from 'express';

export const customersRouter = Router();

customersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { email, phone, metadata } = req.body;

    if (!email) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'email is required' } });
      return;
    }

    const [customer] = await db.insert(CustomersTable).values({
      merchant_id: req.merchantId,
      email,
      phone: phone ?? null,
      metadata: metadata ?? {},
    }).returning();

    res.status(201).json(customer);
  } catch (err) {
    console.error('[customers] create error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create customer' } });
  }
});

customersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const customers = await db
      .select()
      .from(CustomersTable)
      .where(eq(CustomersTable.merchant_id, req.merchantId));

    res.json({ data: customers, total: customers.length });
  } catch (err) {
    console.error('[customers] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list customers' } });
  }
});

customersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [customer] = await db
      .select()
      .from(CustomersTable)
      .where(
        and(
          eq(CustomersTable.id, req.params.id),
          eq(CustomersTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    res.json(customer);
  } catch (err) {
    console.error('[customers] get error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get customer' } });
  }
});
