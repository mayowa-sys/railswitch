import express, { Request, Response } from 'express';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStatusHandler } from './status/route.js';
import { probePostgres, probeRedis } from './status/probes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// package.json sits one level up from src/ (and one level up from dist/ at runtime).
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version: string };

export const app = express();

// Liveness check — does the process respond.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'engine' });
});

// Readiness + introspection — does the process work end-to-end.
app.get(
  '/status',
  createStatusHandler({
    postgres: () => probePostgres(process.env.DATABASE_URL),
    redis: () => probeRedis(),
    version: pkg.version,
    gitSha: process.env.GIT_SHA ?? 'unknown',
  }),
);
