import { Router, type Request, type Response } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { MerchantsTable } from '../schema/merchants.schema.js';
import { ApiKeysTable } from '../schema/api_keys.schema.js';

export const authRouter = Router();

function generateApiKey(mode: 'live' | 'test'): { raw: string; hash: string; prefix: string } {
  const random = randomBytes(24).toString('base64url');
  const raw = `sk_${mode}_${random}`;
  const hashVal = createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12);
  return { raw, hash: hashVal, prefix };
}

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, company } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'name, email, and password are required' } });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Password must be at least 8 characters' } });
      return;
    }

    const existing = await db
      .select({ id: MerchantsTable.id })
      .from(MerchantsTable)
      .where(eq(MerchantsTable.email, email))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'A merchant with this email already exists' } });
      return;
    }

    const passwordHash = await hash(password, 10);

    const [merchant] = await db.insert(MerchantsTable).values({
      name,
      email,
      company: company ?? name,
      password_hash: passwordHash,
    }).returning();

    const apiKey = generateApiKey('test');

    await db.insert(ApiKeysTable).values({
      merchant_id: merchant.id,
      key_hash: apiKey.hash,
      key_prefix: apiKey.prefix,
      type: 'test',
    });

    res.status(201).json({
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        company: merchant.company,
      },
      api_key: apiKey.raw,
    });
  } catch (err) {
    console.error('[auth] register error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register' } });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Email and password are required' } });
      return;
    }

    const [merchant] = await db
      .select()
      .from(MerchantsTable)
      .where(eq(MerchantsTable.email, email))
      .limit(1);

    if (!merchant) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } });
      return;
    }

    const valid = await compare(password, merchant.password_hash);
    if (!valid) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } });
      return;
    }

    const [apiKey] = await db
      .select()
      .from(ApiKeysTable)
      .where(eq(ApiKeysTable.merchant_id, merchant.id))
      .limit(1);

    if (!apiKey || apiKey.revoked_at) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'No active API key found' } });
      return;
    }

    res.json({
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        company: merchant.company,
      },
      api_key_prefix: apiKey.key_prefix,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to login' } });
  }
});
