// services/engine/src/status/route.ts
//
// /status endpoint handler. Returns process info + dependency health.
// Always returns 200 with structured JSON, even when deps are down —
// callers parse the payload to determine health, they don't read the
// status code.

import type { Request, Response } from 'express';
import type { ProbeResult } from './probes.js';

export interface StatusHandlerDeps {
  postgres: () => Promise<ProbeResult>;
  redis: () => Promise<ProbeResult>;
  version: string;
  gitSha: string;
  /** Test seam — overrides the real clock. */
  now?: () => Date;
}

export function createStatusHandler(deps: StatusHandlerDeps) {
  const startedAt = deps.now ? deps.now() : new Date();

  return async (_req: Request, res: Response) => {
    const now = deps.now ? deps.now() : new Date();
    const [postgres, redis] = await Promise.all([deps.postgres(), deps.redis()]);

    const overallStatus =
      postgres.status === 'degraded' || redis.status === 'degraded'
        ? 'degraded'
        : 'ok';

    res.json({
      status: overallStatus,
      service: 'engine',
      version: deps.version,
      git_sha: deps.gitSha,
      started_at: startedAt.toISOString(),
      uptime_seconds: Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      node_version: process.version,
      platform: process.platform,
      dependencies: {
        postgres,
        redis,
      },
    });
  };
}
