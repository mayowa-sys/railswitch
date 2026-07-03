// services/engine/src/webhooks/webhook-dispatcher.ts
//
// Dispatches webhook events to merchant-configured endpoints.
// Events include subscription lifecycle changes, payment outcomes,
// and cascade transitions.

import { db } from '../db/client.js';
import { WebhookEventsTable } from '../schema/webhook_events.schema.js';
import { WebhookEndpointsTable } from '../schema/webhook_endpoints.schema.js';
import { eq } from 'drizzle-orm';
import { GlobalLogger } from '../utils/logger.js';

const logger = new GlobalLogger('WebhookDispatcher');

export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.active'
  | 'subscription.cancelled'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.trial_ending'
  | 'subscription.plan_changed'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.recovered'
  | 'invoice.created'
  | 'invoice.paid'
  | 'invoice.uncollectible'
  | 'cascade.retrying'
  | 'cascade.va_fallback'
  | 'cascade.whatsapp_fallback'
  | 'cascade.past_due'
  | 'cascade.recovered';

export interface WebhookPayload {
  event: WebhookEventType;
  merchant_id: string;
  data: Record<string, unknown>;
  created_at: string;
}

export async function dispatchWebhookEvent(
  merchantId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
) {
  const payload: WebhookPayload = {
    event,
    merchant_id: merchantId,
    data,
    created_at: new Date().toISOString(),
  };

  // Store event record
  try {
    await db.insert(WebhookEventsTable).values({
      merchant_id: merchantId,
      event_type: event,
      payload,
      status: 'pending',
    });
  } catch (err) {
    logger.error('Failed to store webhook event', err as Error, { event, merchantId });
  }

  // Deliver to all active endpoints
  try {
    const endpoints = await db
      .select()
      .from(WebhookEndpointsTable)
      .where(eq(WebhookEndpointsTable.merchant_id, merchantId));

    for (const endpoint of endpoints) {
      if (!endpoint.is_active) continue;

      // Check if endpoint subscribes to this event type
      const subscriptions = (endpoint.subscriptions as string[]) ?? [];
      if (subscriptions.length > 0 && !subscriptions.includes(event)) continue;

      deliverWebhook(endpoint.url, payload, endpoint.id, merchantId).catch((err) => {
        logger.error('Webhook delivery failed', err as Error, { event, endpointId: endpoint.id });
      });
    }
  } catch (err) {
    logger.error('Failed to fetch webhook endpoints', err as Error, { merchantId });
  }
}

async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  endpointId: string,
  merchantId: string,
) {
  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const signature = await hmacSign(body + timestamp);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RailSwitch-Signature': signature,
        'X-RailSwitch-Timestamp': timestamp,
        'X-RailSwitch-Event': payload.event,
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      logger.info('Webhook delivered', { event: payload.event, endpointId, status: res.status });
    } else {
      logger.warn('Webhook delivery returned error', { event: payload.event, endpointId, status: res.status });
    }
  } catch (err) {
    logger.error('Webhook delivery failed', err as Error, { event: payload.event, endpointId });
  }
}

async function hmacSign(data: string): Promise<string> {
  const secret = process.env.WEBHOOK_SECRET || 'railswitch-webhook-secret-dev';
  const { createHmac } = await import('node:crypto');
  return createHmac('sha256', secret).update(data).digest('hex');
}
