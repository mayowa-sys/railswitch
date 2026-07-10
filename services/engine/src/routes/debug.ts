import { Router } from 'express';
import type { Request, Response } from 'express';
import { subscriptionMachine } from '../state-machines/subscription.js';
import { getOrchestrator } from '../rails/billing-handler-dependencies.js';

export const debugRouter = Router();

debugRouter.get('/subscription-machine', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG !== 'true') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Debug endpoints disabled in production' } });
    return;
  }
  res.json(subscriptionMachine.config);
});

debugRouter.get('/nomba-config', (req: Request, res: Response) => {
  res.json({
    clientId: !!process.env.NOMBA_CLIENT_ID,
    clientSecret: !!process.env.NOMBA_CLIENT_SECRET,
    accountId: !!process.env.NOMBA_ACCOUNT_ID, 
    baseUrl: process.env.NOMBA_BASE_URL || '(not set)',
    subAccountId: !!process.env.NOMBA_SUB_ACCOUNT_ID,
  });
});

debugRouter.get('/test-va', async (req: Request, res: Response) => {
  try {
    const orch = getOrchestrator();
    const va = await orch.createVirtualAccount({
      context: { subscriptionId: 'test', merchantId: 'mer_k_W0XspbNN', customerId: 'test', planId: 'test', policy: {} as any, retryCount: 0 },
      amount: 9900,
      invoiceId: 'test_va_' + Date.now(),
      expiresInDays: 7,
    });
    res.json({ 
      success: true, 
      vaId: va.vaId, 
      accountNumber: va.accountNumber,
      bankName: va.bankName, 
      expiresAt: va.expiresAt,
      keys: Object.keys(va),
    });
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});
