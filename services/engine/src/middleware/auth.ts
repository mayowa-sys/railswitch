import type { Request, Response, NextFunction } from 'express';

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers['x-internal-auth'];
  const expected = process.env.INTERNAL_AUTH_SECRET;

  if (!expected) {
    console.error('INTERNAL_AUTH_SECRET not set');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' } });
    return;
  }

  if (!auth || auth !== expected) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal auth secret' } });
    return;
  }

  next();
}
