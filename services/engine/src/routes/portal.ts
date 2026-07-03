
import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/client.js';
import { CustomersTable } from '../schema/customers.schema.js';

export const portalRouter = Router();

const PORTAL_SECRET = process.env.PORTAL_SECRET || 'railswitch-portal-secret-dev';
const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3100';

export function signToken(customerId: string, merchantId: string): string {
  const payload = Buffer.from(JSON.stringify({ customerId, merchantId, exp: Date.now() + 7 * 86400000 }));
  const sig = crypto.createHmac('sha256', PORTAL_SECRET).update(payload).digest('hex');
  return `${payload.toString('base64url')}.${sig}`;
}

export function generatePortalLink(customerId: string, merchantId: string): string {
  const token = signToken(customerId, merchantId);
  return `${PORTAL_URL}/portal?token=${token}`;
}

export function verifyToken(token: string): { customerId: string; merchantId: string } | null {
  try {
    const [payloadB64, sig] = token.split('.');
    const payload = Buffer.from(payloadB64, 'base64url');
    const expectedSig = crypto.createHmac('sha256', PORTAL_SECRET).update(payload).digest('hex');
    if (sig !== expectedSig) return null;
    
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
    });
  } catch (err) {
    console.error('[portal] resolve error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve token' } });
  }
});
