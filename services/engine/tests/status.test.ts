// services/engine/tests/status.test.ts
//
// Tests for the /status route handler. Probes are injected, so these
// tests run with no infrastructure — no Postgres, no Redis, no network.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createStatusHandler, type StatusHandlerDeps } from '../src/status/route.js';

function makeApp(overrides: Partial<StatusHandlerDeps> = {}) {
  const defaults: StatusHandlerDeps = {
    postgres: async () => ({ status: 'ok', latencyMs: 5 }),
    redis: async () => ({ status: 'not_configured' }),
    version: '0.1.0',
    gitSha: 'abc1234',
  };
  const app = express();
  app.get('/status', createStatusHandler({ ...defaults, ...overrides }));
  return app;
}

describe('GET /status', () => {
  it('returns 200 with expected shape when probes succeed', async () => {
    const res = await request(makeApp()).get('/status');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('engine');
    expect(res.body.version).toBe('0.1.0');
    expect(res.body.git_sha).toBe('abc1234');
    expect(res.body.dependencies.postgres.status).toBe('ok');
    expect(res.body.dependencies.postgres.latencyMs).toBe(5);
    expect(res.body.dependencies.redis.status).toBe('not_configured');
    expect(typeof res.body.uptime_seconds).toBe('number');
    expect(res.body.uptime_seconds).toBeGreaterThanOrEqual(0);
    expect(res.body.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof res.body.node_version).toBe('string');
    expect(typeof res.body.platform).toBe('string');
  });

  it('marks overall status as degraded when postgres probe fails', async () => {
    const app = makeApp({
      postgres: async () => ({ status: 'degraded', details: 'connection refused' }),
    });
    const res = await request(app).get('/status');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.postgres.status).toBe('degraded');
    expect(res.body.dependencies.postgres.details).toBe('connection refused');
  });

  it('marks overall status as degraded when redis probe fails', async () => {
    const app = makeApp({
      redis: async () => ({ status: 'degraded', details: 'timeout' }),
    });
    const res = await request(app).get('/status');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.dependencies.redis.status).toBe('degraded');
  });

  it('treats not_configured deps as healthy overall', async () => {
    const app = makeApp({
      postgres: async () => ({ status: 'not_configured' }),
      redis: async () => ({ status: 'not_configured' }),
    });
    const res = await request(app).get('/status');

    expect(res.body.status).toBe('ok');
  });

  it('uses the injected clock for started_at and uptime', async () => {
    const started = new Date('2026-06-22T10:00:00.000Z');
    let callCount = 0;
    const app = makeApp({
      // First call captures startedAt; second call is "now" inside the handler.
      now: () => (callCount++ === 0 ? started : new Date(started.getTime() + 90_000)),
    });
    const res = await request(app).get('/status');

    expect(res.body.started_at).toBe('2026-06-22T10:00:00.000Z');
    expect(res.body.uptime_seconds).toBe(90);
  });
});
