import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { InvoicesTable } from '../schema/invoices.schema.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { ProcessedEventsTable } from '../schema/processed_events.schema.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';
import { eq } from 'drizzle-orm';
import { emitWebhooks } from '../webhooks/emitter.js';
import { GlobalLogger } from '../utils/logger.js';

export const webhooksRouter = Router();
const logger = new GlobalLogger('WebhookHandler');

function verifyNombaSignature(body: Buffer, signature: string): boolean {
  const secret = process.env.NOMBA_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('No NOMBA_WEBHOOK_SECRET set — skipping signature verification');
    return true;
  }
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

webhooksRouter.post('/nomba', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['nomba-signature'] as string | undefined;
    if (signature) {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body));
      if (!verifyNombaSignature(rawBody, signature)) {
        res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Bad signature' } });
        return;
      }
    }

    const { event_type, requestId, data: eventData } = req.body as {
      event_type: string;
      requestId: string;
      data: Record<string, unknown>;
    };

    if (!event_type || !requestId) {
      res.status(400).json({
        error: { code: 'INVALID_REQUEST', message: 'Missing event_type or requestId' },
      });
      return;
    }

    // Idempotency: skip if already processed
    const [existing] = await db
      .select()
      .from(ProcessedEventsTable)
      .where(eq(ProcessedEventsTable.idempotency_key, `nomba:${requestId}`))
      .limit(1);

    if (existing) {
      logger.info('Duplicate Nomba webhook, skipping', { event_type, requestId });
      res.status(200).json({ status: 'ok', deduplicated: true });
      return;
    }

    logger.info('Processing Nomba webhook', { event_type, requestId });

    switch (event_type) {
      case 'payment_success': {
        await handlePaymentSuccess(eventData, requestId);
        break;
      }
      case 'virtual_account.funded': {
        await handleVAFunded(eventData, requestId);
        break;
      }
      case 'transfer.success': {
        logger.info('Transfer succeeded', { requestId, data: eventData });
        break;
      }
      case 'transfer.failed': {
        logger.warn('Transfer failed', { requestId, data: eventData });
        break;
      }
      default: {
        logger.info('Unhandled event type', { event_type, requestId });
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    logger.error('Webhook processing error', err as Error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' } });
  }
});

async function handlePaymentSuccess(
  eventData: Record<string, unknown>,
  requestId: string,
) {
  const merchant = (eventData.merchant ?? eventData) as Record<string, unknown>;
  const merchantTxRef = (merchant.merchantTxRef ?? merchant.orderReference ?? '') as string;

  if (!merchantTxRef) {
    logger.warn('payment_success without merchantTxRef', { requestId });
    return;
  }

  // Try to find invoice by merchantTxRef
  const invoices = await db
    .select()
    .from(InvoicesTable)
    .where(eq(InvoicesTable.id, merchantTxRef))
    .limit(1);

  let subscription;
  let invoice;
  
  if (invoices.length > 0) {
    invoice = invoices[0];
    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, invoice.subscription_id))
      .limit(1);
    subscription = sub;
  }
  
  // If no invoice found, try looking up subscription directly by merchantTxRef
  if (!subscription) {
    const [sub] = await db
      .select()
      .from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.id, merchantTxRef))
      .limit(1);
    subscription = sub;
  }

  if (!subscription) {
    logger.warn('payment_success: no matching invoice or subscription', { merchantTxRef });
    await recordProcessed(requestId);
    return;
  }

  const repo = new DrizzleSubscriptionRepository(db, subscription.merchant_id);
  const wrapper = new SubscriptionWrapper({ repo });

  const amount = Number(eventData.amount ?? invoice.amount);

  // Advance state machine: charge succeeded
  const result = await wrapper.processEvent({
    subscriptionId: subscription.id,
    event: {
      type: 'CHARGE_SUCCEEDED',
      chargeId: requestId,
    },
    idempotencyKey: `webhook:payment_success:${requestId}`,
  });

  // Mark invoice as paid if it exists
  if (invoice) {
    await db
      .update(InvoicesTable)
      .set({
        status: 'paid',
        amount_paid: String(amount),
        paid_at: new Date(),
      })
      .where(eq(InvoicesTable.id, invoice.id));
  }

  await recordProcessed(requestId);

  // Emit outbound webhooks
  await emitWebhooks({
    event: 'charge.succeeded',
    data: {
      subscription_id: subscription.id,
      invoice_id: invoice.id,
      amount,
      charge_id: requestId,
    },
    merchant_id: subscription.merchant_id,
  });

  logger.info('payment_success processed', {
    subscriptionId: subscription.id,
    newState: result.state,
  });
}

async function handleVAFunded(
  eventData: Record<string, unknown>,
  requestId: string,
) {
  const accountRef = (eventData.accountRef ?? '') as string;

  if (!accountRef) {
    logger.warn('virtual_account.funded without accountRef', { requestId });
    return;
  }

  // Find invoice by accountRef (our VA reference = invoice ID)
  const invoices = await db
    .select()
    .from(InvoicesTable)
    .where(eq(InvoicesTable.id, accountRef))
    .limit(1);

  if (invoices.length === 0) {
    logger.warn('virtual_account.funded: no matching invoice', { accountRef });
    await recordProcessed(requestId);
    return;
  }

  const invoice = invoices[0];

  const [subscription] = await db
    .select()
    .from(SubscriptionsTable)
    .where(eq(SubscriptionsTable.id, invoice.subscription_id))
    .limit(1);

  if (!subscription) {
    await recordProcessed(requestId);
    return;
  }

  const repo = new DrizzleSubscriptionRepository(db, subscription.merchant_id);
  const wrapper = new SubscriptionWrapper({ repo });

  const amountReceived = Number(eventData.amountReceived ?? eventData.amount ?? invoice.amount);
  const amountExpected = Number(eventData.amountExpected ?? invoice.amount);

  // Handle under/over payment
  if (amountReceived < amountExpected) {
    logger.warn('VA short-payment detected', {
      accountRef,
      amountReceived,
      amountExpected,
    });
  }

  // Advance state machine: VA credited
  const result = await wrapper.processEvent({
    subscriptionId: subscription.id,
    event: {
      type: 'VA_CREDITED',
      amount: amountReceived,
    },
    idempotencyKey: `webhook:va_funded:${requestId}`,
  });

  await db
    .update(InvoicesTable)
    .set({
      status: 'paid',
      amount_paid: String(amountReceived),
      paid_at: new Date(),
    })
    .where(eq(InvoicesTable.id, invoice.id));

  await recordProcessed(requestId);

  await emitWebhooks({
    event: 'va.credited',
    data: {
      subscription_id: subscription.id,
      invoice_id: invoice.id,
      amount_received: amountReceived,
      amount_expected: amountExpected,
    },
    merchant_id: subscription.merchant_id,
  });

  logger.info('virtual_account.funded processed', {
    subscriptionId: subscription.id,
    newState: result.state,
  });
}

async function recordProcessed(requestId: string) {
  try {
    await db.insert(ProcessedEventsTable).values({
      merchant_id: 'webhook',
      subscription_id: 'webhook',
      idempotency_key: `nomba:${requestId}`,
      cached_state: 'active',
      cached_context: { eventType: 'webhook', requestId },
    } as unknown as typeof ProcessedEventsTable.$inferInsert);
  } catch {
    // Already recorded or table constraint — safe to ignore
  }
}
