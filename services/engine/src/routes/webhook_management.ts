import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { WebhookEndpointsTable } from '../schema/webhook_endpoints.schema.js';
import { WebhookEventsTable } from '../schema/webhook_events.schema.js';
import { WebhookDeliveryAttemptsTable } from '../schema/webhook_events.schema.js';

export const webhookManagementRouter = Router();

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`;
}

webhookManagementRouter.post('/endpoints', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'url is required' } });
      return;
    }

    const [endpoint] = await db.insert(WebhookEndpointsTable).values({
      merchant_id: req.merchantId,
      url,
      secret: generateSecret(),
      status: 'active',
    }).returning();

    res.status(201).json(endpoint);
  } catch (err) {
    console.error('[webhooks] create endpoint error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create endpoint' } });
  }
});

webhookManagementRouter.get('/endpoints', async (req: Request, res: Response) => {
  try {
    const endpoints = await db
      .select({
        id: WebhookEndpointsTable.id,
        merchant_id: WebhookEndpointsTable.merchant_id,
        url: WebhookEndpointsTable.url,
        status: WebhookEndpointsTable.status,
        last_delivery_at: WebhookEndpointsTable.last_delivery_at,
        created_at: WebhookEndpointsTable.created_at,
      })
      .from(WebhookEndpointsTable)
      .where(eq(WebhookEndpointsTable.merchant_id, req.merchantId));

    res.json({ data: endpoints, total: endpoints.length });
  } catch (err) {
    console.error('[webhooks] list endpoints error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list endpoints' } });
  }
});

webhookManagementRouter.delete('/endpoints/:id', async (req: Request, res: Response) => {
  try {
    const [endpoint] = await db
      .select()
      .from(WebhookEndpointsTable)
      .where(
        and(
          eq(WebhookEndpointsTable.id, req.params.id),
          eq(WebhookEndpointsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!endpoint) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Endpoint not found' } });
      return;
    }

    await db
      .update(WebhookEndpointsTable)
      .set({ status: 'disabled' })
      .where(
        and(
          eq(WebhookEndpointsTable.id, req.params.id),
          eq(WebhookEndpointsTable.merchant_id, req.merchantId),
        ),
      );

    res.json({ id: req.params.id, disabled: true });
  } catch (err) {
    console.error('[webhooks] delete endpoint error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete endpoint' } });
  }
});

webhookManagementRouter.post('/deliveries/:id/replay', async (req: Request, res: Response) => {
  try {
    const [delivery] = await db
      .select()
      .from(WebhookDeliveryAttemptsTable)
      .where(
        and(
          eq(WebhookDeliveryAttemptsTable.id, req.params.id),
          eq(WebhookDeliveryAttemptsTable.merchant_id, req.merchantId),
        ),
      )
      .limit(1);

    if (!delivery) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Delivery attempt not found' } });
      return;
    }

    // Reset for immediate retry
    await db
      .update(WebhookDeliveryAttemptsTable)
      .set({ status: 'pending', next_attempt_at: new Date() })
      .where(eq(WebhookDeliveryAttemptsTable.id, req.params.id));

    res.json({ id: req.params.id, replayed: true });
  } catch (err) {
    console.error('[webhooks] replay error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to replay delivery' } });
  }
});

webhookManagementRouter.get('/deliveries', async (req: Request, res: Response) => {
  try {
    const deliveries = await db
      .select()
      .from(WebhookDeliveryAttemptsTable)
      .where(eq(WebhookDeliveryAttemptsTable.merchant_id, req.merchantId))
      .orderBy(WebhookDeliveryAttemptsTable.created_at)
      .limit(50);

    res.json({ data: deliveries, total: deliveries.length });
  } catch (err) {
    console.error('[webhooks] list deliveries error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list deliveries' } });
  }
});

webhookManagementRouter.get('/events', async (req: Request, res: Response) => {
  try {
    const events = await db
      .select()
      .from(WebhookEventsTable)
      .where(eq(WebhookEventsTable.merchant_id, req.merchantId))
      .limit(50);

    res.json({ data: events, total: events.length });
  } catch (err) {
    console.error('[webhooks] list events error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list events' } });
  }
});
