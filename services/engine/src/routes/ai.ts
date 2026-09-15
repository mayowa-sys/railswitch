// services/engine/src/routes/ai.ts
//
// Internal AI routes. Not customer-facing — mounted under /internal/v1/ai
// and reached by the gateway proxy. Every endpoint validates input and
// returns typed JSON.

import { Router, type Request, type Response } from 'express';
import { generateDunningMessage, type CascadeStage, type DunningChannel } from '../ai/dunning-generator.js';
import { rankRetrySlots } from '../ai/retry-timing-model.js';
import { scoreSubscriptionChurn, scoreMerchantChurn } from '../ai/churn-features.js';

export const aiRouter = Router();

/**
 * POST /internal/v1/ai/dunning-preview
 * Returns a generated dunning message (or the template fallback if AI is
 * unavailable). Merchants can use this to preview copy before sending.
 */
aiRouter.post('/dunning-preview', async (req: Request, res: Response) => {
  const b = req.body ?? {};
  const channel = b.channel as DunningChannel;
  const stage = b.stage as CascadeStage;
  if (channel !== 'whatsapp' && channel !== 'email') {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: "channel must be 'whatsapp' or 'email'" } });
    return;
  }
  const validStages: CascadeStage[] = ['retrying', 'va_fallback', 'whatsapp_fallback', 'past_due'];
  if (!validStages.includes(stage)) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: `stage must be one of ${validStages.join(', ')}` } });
    return;
  }
  const amountNaira = Number(b.amountNaira ?? b.amount_naira ?? 0);
  const fallbackSubject = `Payment reminder — ${b.planName ?? 'your subscription'}`;
  const fallbackBody = `Hi ${b.customerName ?? 'there'}, your payment of ₦${amountNaira.toLocaleString()} for ${b.planName ?? 'your subscription'} could not be processed. Please update your payment method or transfer to the account on file.`;

  const generated = await generateDunningMessage(
    {
      channel,
      stage,
      customerName: String(b.customerName ?? 'Customer'),
      planName: String(b.planName ?? 'your subscription'),
      amountNaira,
      daysOverdue: b.daysOverdue !== undefined ? Number(b.daysOverdue) : undefined,
      retryCount: b.retryCount !== undefined ? Number(b.retryCount) : undefined,
      vaAccountNumber: b.vaAccountNumber,
      vaBankName: b.vaBankName,
      paymentLink: b.paymentLink,
      merchantName: b.merchantName,
      toneHint: b.toneHint,
    },
    { subject: fallbackSubject, body: fallbackBody },
  );
  res.json({ data: generated });
});

/**
 * POST /internal/v1/ai/retry-recommendation
 * Returns the top-N retry slots ranked by predicted success probability.
 */
aiRouter.post('/retry-recommendation', (req: Request, res: Response) => {
  const b = req.body ?? {};
  const retryCount = Number(b.retryCount ?? 0);
  const amountNaira = Number(b.amountNaira ?? 0);
  const currentTime = b.currentTime ? new Date(b.currentTime) : new Date();
  if (Number.isNaN(currentTime.getTime())) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'currentTime must be an ISO date' } });
    return;
  }
  const policy = {
    maxRetries: Number(b.policy?.maxRetries ?? 3),
    ussdEnabled: Boolean(b.policy?.ussdEnabled ?? true),
    graceHours: Number(b.policy?.graceHours ?? 72),
    baseDelayMinutes: Number(b.policy?.baseDelayMinutes ?? 60),
    maxDelayHours: Number(b.policy?.maxDelayHours ?? 72),
  };
  const topN = Math.min(20, Math.max(1, Number(b.topN ?? 5)));
  const ranked = rankRetrySlots({ currentTime, retryCount, policy, amountNaira }, topN);
  res.json({
    data: ranked.map(r => ({
      at: r.at.toISOString(),
      probability: r.probability,
      hourWAT: r.features.hourWAT,
      dayOfMonth: r.features.dayOfMonth,
      isPaydayWindow: r.features.isPaydayWindow === 1,
      isLiquidityWindow: r.features.isLiquidityWindow === 1,
    })),
  });
});

/**
 * GET /internal/v1/ai/churn/:subscriptionId
 * Score churn risk for one subscription.
 */
aiRouter.get('/churn/:subscriptionId', async (req: Request, res: Response) => {
  const merchantId = req.merchantId;
  const result = await scoreSubscriptionChurn(merchantId, req.params.subscriptionId);
  if (!result) {
    res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Subscription not found' } });
    return;
  }
  res.json({ data: result });
});

/**
 * GET /internal/v1/ai/churn
 * Score churn risk for every subscription belonging to the caller merchant.
 */
aiRouter.get('/churn', async (req: Request, res: Response) => {
  const scores = await scoreMerchantChurn(req.merchantId);
  res.json({ data: scores, total: scores.length });
});
