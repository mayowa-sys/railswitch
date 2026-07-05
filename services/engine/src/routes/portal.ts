
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { CustomersTable } from '../schema/customers.schema.js';
import { MerchantsTable } from '../schema/merchants.schema.js';
import { SubscriptionsTable } from '../schema/subscriptions.schema.js';
import { DrizzleSubscriptionRepository } from '../db/drizzle-repository.js';
import { SubscriptionWrapper } from '../wrapper/subscription-wrapper.js';

export const portalRouter = Router();

const PORTAL_SECRET = process.env.PORTAL_SECRET;
if (!PORTAL_SECRET) {
  console.error('[portal] FATAL: PORTAL_SECRET is not set — portal tokens are insecure!');
}
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3100';

export function signToken(customerId: string, merchantId: string): string {
  const secret = PORTAL_SECRET || 'railswitch-portal-secret-dev';
  const payload = Buffer.from(JSON.stringify({ customerId, merchantId, exp: Date.now() + 7 * 86400000 }));
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload.toString('base64url')}.${sig}`;
}

export function generatePortalLink(customerId: string, merchantId: string): string {
  const token = signToken(customerId, merchantId);
  return `${PORTAL_URL}/portal?token=${token}`;
}

export function verifyToken(token: string): { customerId: string; merchantId: string } | null {
  try {
    const secret = PORTAL_SECRET || 'railswitch-portal-secret-dev';
    const [payloadB64, sig] = token.split('.');
    const payload = Buffer.from(payloadB64, 'base64url');
    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'))) return null;
    
    const data = JSON.parse(payload.toString());
    if (Date.now() > data.exp) return null;
    
    return { customerId: data.customerId, merchantId: data.merchantId };
  } catch {
    return null;
  }
}

// Generate a portal link for a customer
portalRouter.post('/customers/:id/portal-link', async (req: Request, res: Response) => {
  try {
    const [customer] = await db
      .select()
      .from(CustomersTable)
      .where(eq(CustomersTable.id, req.params.id))
      .limit(1);

    if (!customer || customer.merchant_id !== (req as Request & { merchantId: string }).merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    const token = signToken(customer.id, customer.merchant_id);
    const portalUrl = `${process.env.PORTAL_URL || 'http://localhost:3100'}/portal?token=${token}`;

    res.json({ portal_url: portalUrl, token, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() });
  } catch (err) {
    console.error('[portal] link error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate portal link' } });
  }
});

// Resolve a portal token to customer data
// Public endpoint - token-based auth, no merchant header needed
portalRouter.get('/resolve', async (req: Request, res: Response) => {
  try {
    const token = (req.headers['x-portal-token'] || req.query.token) as string;
    if (!token) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Token required' } });
      return;
    }

    const data = verifyToken(token);
    if (!data) {
      res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
      return;
    }

    const [customer] = await db
      .select()
      .from(CustomersTable)
      .where(eq(CustomersTable.id, data.customerId))
      .limit(1);

    if (!customer) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } });
      return;
    }

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        created_at: customer.created_at,
      },
      merchant_id: data.merchantId,
      merchant_name: (await db.select({ name: MerchantsTable.name }).from(MerchantsTable).where(eq(MerchantsTable.id, data.merchantId)).limit(1))[0]?.name ?? 'Merchant',
    });
  } catch (err) {
    console.error('[portal] resolve error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve token' } });
  }
});

function authPortal(req: Request, res: Response): { customerId: string; merchantId: string } | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing portal token' } });
    return null;
  }
  const data = verifyToken(auth.slice(7));
  if (!data) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid portal token' } });
    return null;
  }
  return data;
}

portalRouter.get('/v1/portal/subscription', async (req: Request, res: Response) => {
  try {
    const auth = authPortal(req, res);
    if (!auth) return;

    const [sub] = await db.select().from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.customer_id, auth.customerId))
      .limit(1);

    if (!sub || sub.merchant_id !== auth.merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No subscription found' } });
      return;
    }

    res.json({ subscription: sub });
  } catch (err) {
    console.error('[portal] subscription error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to get subscription' } });
  }
});

portalRouter.post('/v1/portal/subscription/pause', async (req: Request, res: Response) => {
  try {
    const auth = authPortal(req, res);
    if (!auth) return;

    const [sub] = await db.select().from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.customer_id, auth.customerId))
      .limit(1);

    if (!sub || sub.merchant_id !== auth.merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No subscription found' } });
      return;
    }

    const repo = new DrizzleSubscriptionRepository(db, auth.merchantId);
    const wrapper = new SubscriptionWrapper({ repo });
    await wrapper.processEvent({
      subscriptionId: sub.id,
      event: { type: 'PAUSE_REQUESTED', actor: 'customer' },
      idempotencyKey: `portal:pause:${sub.id}:${Date.now()}`,
    });

    res.json({ subscription: { ...sub, status: 'paused' } });
  } catch (err) {
    console.error('[portal] pause error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to pause subscription' } });
  }
});

portalRouter.post('/v1/portal/subscription/resume', async (req: Request, res: Response) => {
  try {
    const auth = authPortal(req, res);
    if (!auth) return;

    const [sub] = await db.select().from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.customer_id, auth.customerId))
      .limit(1);

    if (!sub || sub.merchant_id !== auth.merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No subscription found' } });
      return;
    }

    const repo = new DrizzleSubscriptionRepository(db, auth.merchantId);
    const wrapper = new SubscriptionWrapper({ repo });
    await wrapper.processEvent({
      subscriptionId: sub.id,
      event: { type: 'RESUME_REQUESTED', actor: 'customer' },
      idempotencyKey: `portal:resume:${sub.id}:${Date.now()}`,
    });

    res.json({ subscription: { ...sub, status: 'active' } });
  } catch (err) {
    console.error('[portal] resume error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to resume subscription' } });
  }
});

portalRouter.post('/v1/portal/subscription/cancel', async (req: Request, res: Response) => {
  try {
    const auth = authPortal(req, res);
    if (!auth) return;

    const [sub] = await db.select().from(SubscriptionsTable)
      .where(eq(SubscriptionsTable.customer_id, auth.customerId))
      .limit(1);

    if (!sub || sub.merchant_id !== auth.merchantId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No subscription found' } });
      return;
    }

    const repo = new DrizzleSubscriptionRepository(db, auth.merchantId);
    const wrapper = new SubscriptionWrapper({ repo });
    await wrapper.processEvent({
      subscriptionId: sub.id,
      event: { type: 'CANCEL_REQUESTED', actor: 'customer', reason: req.body?.reason ?? 'Customer cancelled via portal' },
      idempotencyKey: `portal:cancel:${sub.id}:${Date.now()}`,
    });

    res.json({ subscription: { ...sub, status: 'cancelled' } });
  } catch (err) {
    console.error('[portal] cancel error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel subscription' } });
  }
});
