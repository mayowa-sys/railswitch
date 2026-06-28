import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      merchantId: string;
    }
  }
}

export function extractMerchantId(req: Request, res: Response, next: NextFunction): void {
  const merchantId = req.headers['x-merchant-id'] as string | undefined;

  if (!merchantId) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing X-Merchant-Id header' } });
    return;
  }

  req.merchantId = merchantId;
  next();
}
