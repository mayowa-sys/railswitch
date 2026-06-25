import { Router } from 'express';
import type { Request, Response } from 'express';
import { subscriptionMachine } from '../state-machines/subscription.js';

export const debugRouter = Router();

debugRouter.get('/subscription-machine', (_req: Request, res: Response) => {
  res.json(subscriptionMachine.config);
});
