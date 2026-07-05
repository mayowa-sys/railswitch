import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers['x-internal-auth'];
  const expected = process.env.INTERNAL_AUTH_SECRET;

  if (!expected) {
    console.error('INTERNAL_AUTH_SECRET not set');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server configuration error' } });
    return;
  }

  if (!auth || typeof auth !== 'string') {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal auth secret' } });
    return;
  }

  const authBuf = Buffer.from(auth, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (authBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(authBuf, expectedBuf)) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid internal auth secret' } });
    return;
  }

  next();
}
