import { createHmac } from 'node:crypto';
import { db } from '../db/client.js';
import { WebhookEndpointsTable } from '../schema/webhook_endpoints.schema.js';
import { WebhookEventsTable, WebhookDeliveryAttemptsTable } from '../schema/webhook_events.schema.js';
import { eq, and } from 'drizzle-orm';

const RETRY_BACKOFF_MS = [0, 30_000, 120_000, 600_000, 1_800_000, 7_200_000, 18_000_000, 36_000_000, 86_400_000];
const MAX_ATTEMPTS = 9;

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  merchant_id: string;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export async function emitWebhooks(payload: WebhookPayload): Promise<void> {
  const { event, data, merchant_id } = payload;

  // Look up active endpoints for this merchant
  const endpoints = await db
    .select()
    .from(WebhookEndpointsTable)
    .where(
      and(
        eq(WebhookEndpointsTable.merchant_id, merchant_id),
        eq(WebhookEndpointsTable.status, 'active'),
      ),
    );

  if (endpoints.length === 0) return;

  // Record the event once
  const [webhookEvent] = await db
    .insert(WebhookEventsTable)
    .values({
      merchant_id,
      event,
      payload: data,
    })
    .returning();

  if (!webhookEvent) return;

  // Create delivery attempts per endpoint
  const body = JSON.stringify({ event, data });
  const now = new Date();

  for (const endpoint of endpoints) {
    const signature = signPayload(body, endpoint.secret);

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RailSwitch-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      await db.insert(WebhookDeliveryAttemptsTable).values({
        endpoint_id: endpoint.id,
        event_id: webhookEvent.id,
        merchant_id,
        status: res.ok ? 'delivered' : 'failed',
        status_code: res.status,
        attempts: 1,
        delivered_at: res.ok ? now : null,
        next_attempt_at: res.ok ? null : new Date(now.getTime() + RETRY_BACKOFF_MS[1]),
      });

      // Update endpoint last_delivery_at
      await db
        .update(WebhookEndpointsTable)
        .set({ last_delivery_at: now })
        .where(eq(WebhookEndpointsTable.id, endpoint.id));

      if (!res.ok && endpoint.status === 'active') {
        // Mark as failing after 3 consecutive failures
        const failures = await db
          .select()
          .from(WebhookDeliveryAttemptsTable)
          .where(
            and(
              eq(WebhookDeliveryAttemptsTable.endpoint_id, endpoint.id),
              eq(WebhookDeliveryAttemptsTable.status, 'failed'),
            ),
          )
          .limit(3);

        if (failures.length >= 3) {
          await db
            .update(WebhookEndpointsTable)
            .set({ status: 'failing' })
            .where(eq(WebhookEndpointsTable.id, endpoint.id));
        }
      }
    } catch {
      // Network error — queue for retry
      await db.insert(WebhookDeliveryAttemptsTable).values({
        endpoint_id: endpoint.id,
        event_id: webhookEvent.id,
        merchant_id,
        status: 'pending',
        status_code: null,
        attempts: 0,
        next_attempt_at: new Date(now.getTime() + RETRY_BACKOFF_MS[1]),
      });
    }
  }
}

/** Retries pending deliveries. Called periodically (e.g., every 5 min). */
export async function retryPendingDeliveries(): Promise<void> {
  const now = new Date();

  const pending = await db
    .select()
    .from(WebhookDeliveryAttemptsTable)
    .where(eq(WebhookDeliveryAttemptsTable.status, 'pending'))
    .limit(25);

  for (const delivery of pending) {
    if (!delivery.next_attempt_at || delivery.next_attempt_at > now) continue;
    if (delivery.attempts >= MAX_ATTEMPTS) {
      await db
        .update(WebhookDeliveryAttemptsTable)
        .set({ status: 'failed' })
        .where(eq(WebhookDeliveryAttemptsTable.id, delivery.id));
      continue;
    }

    const [endpoint] = await db
      .select()
      .from(WebhookEndpointsTable)
      .where(eq(WebhookEndpointsTable.id, delivery.endpoint_id))
      .limit(1);

    if (!endpoint || endpoint.status === 'disabled') continue;

    const [event] = await db
      .select()
      .from(WebhookEventsTable)
      .where(eq(WebhookEventsTable.id, delivery.event_id))
      .limit(1);

    if (!event) continue;

    const body = JSON.stringify({ event: event.event, data: event.payload as Record<string, unknown> });
    const signature = signPayload(body, endpoint.secret);

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'RailSwitch-Signature': signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      const newAttempts = delivery.attempts + 1;

      if (res.ok) {
        await db
          .update(WebhookDeliveryAttemptsTable)
          .set({
            status: 'delivered',
            status_code: res.status,
            attempts: newAttempts,
            delivered_at: now,
          })
          .where(eq(WebhookDeliveryAttemptsTable.id, delivery.id));
      } else if (newAttempts >= MAX_ATTEMPTS) {
        await db
          .update(WebhookDeliveryAttemptsTable)
          .set({ status: 'failed', status_code: res.status, attempts: newAttempts })
          .where(eq(WebhookDeliveryAttemptsTable.id, delivery.id));
      } else {
        await db
          .update(WebhookDeliveryAttemptsTable)
          .set({
            status_code: res.status,
            attempts: newAttempts,
            next_attempt_at: new Date(now.getTime() + RETRY_BACKOFF_MS[newAttempts - 1]),
          })
          .where(eq(WebhookDeliveryAttemptsTable.id, delivery.id));
      }
    } catch {
      const newAttempts = delivery.attempts + 1;
      await db
        .update(WebhookDeliveryAttemptsTable)
        .set({
          attempts: newAttempts,
          next_attempt_at: newAttempts >= MAX_ATTEMPTS
            ? null
            : new Date(now.getTime() + RETRY_BACKOFF_MS[newAttempts - 1]),
          status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        })
        .where(eq(WebhookDeliveryAttemptsTable.id, delivery.id));
    }
  }
}
