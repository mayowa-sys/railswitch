import express, { Request, Response } from 'express';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

export const app = express();

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
