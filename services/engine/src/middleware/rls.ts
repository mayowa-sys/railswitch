import type { Request, Response, NextFunction } from 'express';
import { db } from '../db/client.js';

export async function setRLSContext(req: Request, res: Response, next: NextFunction) {
  try {
    await db.execute(`SELECT set_config('app.current_merchant_id', '${req.merchantId}', false)`);
    next();
  } catch (err) {
    next(err);
  }
}
