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
  // Portal resolve is token-based — merchant ID is extracted from the signed token
  if (req.path === '/resolve' && (req.method === 'GET' || req.method === 'HEAD')) {
    next();
    return;
  }
  // Auth register/login are no-merchant endpoints
  if ((req.path === '/register' || req.path === '/login') && req.method === 'POST') {
    next();
    return;
  }

  const merchantId = req.headers['x-merchant-id'] as string | undefined;

  if (!merchantId) {
    res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Missing X-Merchant-Id header' } });
    return;
  }

  req.merchantId = merchantId;
  next();
}
