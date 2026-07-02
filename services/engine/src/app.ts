import express, { Request, Response } from 'express';
import { createHmac } from 'node:crypto';
import { CustomersTable } from './schema/customers.schema.js';
import { eq } from 'drizzle-orm';
import { db } from './db/client.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStatusHandler } from './status/route.js';
import { probePostgres, probeRedis } from './status/probes.js';
import { requireInternalAuth } from './middleware/auth.js';
import { extractMerchantId } from './middleware/merchant.js';
import { requestId } from './middleware/request-id.js';
import { plansRouter } from './routes/plans.js';
import { customersRouter } from './routes/customers.js';
import { subscriptionsRouter } from './routes/subscriptions.js';
import { invoicesRouter } from './routes/invoices.js';
import { paymentMethodsRouter } from './routes/payment_methods.js';
import { debugRouter } from './routes/debug.js';
import { webhooksRouter } from './routes/webhooks.js';
import { authRouter } from './routes/auth.js';
import { auditRouter } from './routes/audit.js';
import { webhookManagementRouter } from './routes/webhook_management.js';
import { cleanupRouter } from './routes/cleanup.js';
import { portalRouter } from './routes/portal.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

export const app = express();
// Public portal token resolution
app.get('/internal/v1/portal/resolve', requireInternalAuth, async (req: Request, res: Response) => {
  try {
    const token = (req.headers['x-portal-token'] || req.query.token) as string;
    if (!token) { res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Token required' } }); return; }
    
    try {
      const PORTAL_SECRET = process.env.PORTAL_SECRET || 'railswitch-portal-secret-dev';
      console.log('[portal-resolve] token received, verifying...');
      const [payloadB64, sig] = token.split('.');
      const payload = Buffer.from(payloadB64, 'base64url');
      const expectedSig = createHmac('sha256', PORTAL_SECRET).update(payload).digest('hex');
      console.log('[portal-resolve] sig match:', expectedSig === sig);
      if (sig !== expectedSig) { console.error('[portal] sig mismatch', { expected: expectedSig.slice(0,10), got: sig.slice(0,10) }); throw new Error('bad sig'); }
      const data = JSON.parse(payload.toString());
      if (Date.now() > data.exp) throw new Error('expired');
      
      console.log('[portal-resolve] looking up customer:', data.customerId);
      const [customer] = await db.select().from(CustomersTable).where(eq(CustomersTable.id, data.customerId)).limit(1);
      console.log('[portal-resolve] customer found:', !!customer);
      if (!customer) { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found' } }); return; }
      
      res.json({ customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, created_at: customer.created_at }, merchant_id: data.merchantId });
    } catch (e) { res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } }); }
  } catch (err) {
    console.error('[portal-resolve] error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve token' } });
  }
});


app.use(express.json());
app.use(requestId);

// Public endpoints — no auth required.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'engine' });
});

app.get(
  '/status',
  createStatusHandler({
    postgres: () => probePostgres(process.env.DATABASE_URL),
    redis: () => probeRedis(),
    version: pkg.version,
    gitSha: process.env.GIT_SHA ?? 'unknown',
  }),
);

// Debug / developer tooling — unprotected.
app.use('/debug', debugRouter);

// Internal API — gateway-only, protected by shared secret + merchant scoping.
app.use('/internal/v1/plans', requireInternalAuth, extractMerchantId, plansRouter);
app.use('/internal/v1/customers', requireInternalAuth, extractMerchantId, customersRouter);
app.use('/internal/v1/subscriptions', requireInternalAuth, extractMerchantId, subscriptionsRouter);
app.use('/internal/v1/invoices', requireInternalAuth, extractMerchantId, invoicesRouter);
app.use('/internal/v1/payment-methods', requireInternalAuth, extractMerchantId, paymentMethodsRouter);

// Internal webhook ingress — auth only, no merchant scoping (engine handler resolves merchant from Nomba payload).
app.use('/internal/v1/webhooks', requireInternalAuth, webhooksRouter);

// Auth — internal auth only, no merchant scoping (login/register create/verify merchants).
app.use('/internal/v1/auth', requireInternalAuth, authRouter);
app.use('/internal/v1/audit-logs', requireInternalAuth, extractMerchantId, auditRouter);

// Webhook management — gateway-only, CRUD + delivery logs.
app.use('/internal/v1/webhooks/management', requireInternalAuth, extractMerchantId, webhookManagementRouter);
app.use('/internal/v1/cleanup', requireInternalAuth, extractMerchantId, cleanupRouter);
app.use('/internal/v1/portal', requireInternalAuth, extractMerchantId, portalRouter);
