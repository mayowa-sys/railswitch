import { Router, type Request, type Response } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { AuditLog } from '../schema/audit_log.schema.js';

export const auditRouter = Router();

auditRouter.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const entries = await db
      .select()
      .from(AuditLog)
      .where(eq(AuditLog.merchant_id, req.merchantId))
      .orderBy(desc(AuditLog.timestamp))
      .limit(limit);

    res.json({ data: entries, total: entries.length });
  } catch (err) {
    console.error('[audit] list error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list audit entries' } });
  }
});

auditRouter.get('/subscription/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const entries = await db
      .select()
      .from(AuditLog)
      .where(
        and(
          eq(AuditLog.merchant_id, req.merchantId),
          eq(AuditLog.subscription_id, req.params.subscriptionId),
        ),
      )
      .orderBy(desc(AuditLog.timestamp))
      .limit(100);

    res.json({ data: entries, total: entries.length });
  } catch (err) {
    console.error('[audit] subscription error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list audit entries' } });
  }
});
