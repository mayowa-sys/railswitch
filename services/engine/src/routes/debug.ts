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
      accountNumber: va.accountNumber,
      keys: Object.keys(va),
      raw: JSON.parse(JSON.stringify(va)),
    });
  } catch (err) {
    res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
  }
});

debugRouter.get('/raw-nomba-va', async (req: Request, res: Response) => {
  const tokenResp = await fetch('https://api.nomba.com/v1/auth/token/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'accountId': process.env.NOMBA_ACCOUNT_ID || 'f666ef9b-888e-4799-85ce-acb505b28023' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.NOMBA_CLIENT_ID, client_secret: process.env.NOMBA_CLIENT_SECRET }),
  });
  const tokenData: any = await tokenResp.json();
  const token = tokenData?.data?.access_token;

  if (!token) { res.json({ error: 'Auth failed', detail: tokenData }); return; }

  const vaResp = await fetch(`https://api.nomba.com/v1/accounts/virtual/${process.env.NOMBA_SUB_ACCOUNT_ID || ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'accountId': process.env.NOMBA_ACCOUNT_ID || '' },
    body: JSON.stringify({ accountName: 'DebugTest', accountRef: `debug_${Date.now()}`, amount: 9900, expiryDate: '2026-07-17' }),
  });
  const vaText = await vaResp.text();
  const vaJson = JSON.parse(vaText);
  
  res.json({
    status: vaResp.status,
    topKeys: Object.keys(vaJson),
    hasData: !!vaJson.data,
    dataKeys: vaJson.data ? Object.keys(vaJson.data as object) : [],
    bankAccountNumber: (vaJson as any)?.data?.bankAccountNumber,
    bankName: (vaJson as any)?.data?.bankName,
  });
});
