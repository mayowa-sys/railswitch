import { Router } from 'express';
import type { Request, Response } from 'express';
import { subscriptionMachine } from '../state-machines/subscription.js';

export const debugRouter = Router();

debugRouter.get('/subscription-machine', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEBUG !== 'true') {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Debug endpoints disabled in production' } });
    return;
  }
  res.json(subscriptionMachine.config);
});
