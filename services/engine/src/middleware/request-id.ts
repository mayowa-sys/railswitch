import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  const id = req.headers['x-request-id'] as string | undefined;
  if (id) {
    req.requestId = id;
  }
  next();
}
