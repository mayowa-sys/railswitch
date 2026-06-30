// services/engine/src/status/probes.ts
//
// Dependency probes for the /status endpoint. Each probe is best-effort:
// returns 'ok' if reachable, 'degraded' on any error, 'not_configured'
// if the dependency hasn't been wired up yet.
//
// Probes never throw — they capture errors into the result. This way
// /status always returns 200 with a structured payload, even when
// everything is on fire.

import { Client } from 'pg';

export type ProbeStatus = 'ok' | 'degraded' | 'not_configured';

export interface ProbeResult {
  status: ProbeStatus;
  details?: string;
  latencyMs?: number;
}

/**
 * Connects to Postgres with a short timeout, runs SELECT 1, disconnects.
 * Returns ok + latency on success, degraded + error message on failure,
 * not_configured if DATABASE_URL isn't set.
 */
export async function probePostgres(connectionString?: string): Promise<ProbeResult> {
  if (!connectionString) {
    return { status: 'not_configured' };
  }
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 2000,
    statement_timeout: 2000,
  });
  const start = Date.now();
  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    try { await client.end(); } catch { /* already failed */ }
    return {
      status: 'degraded',
      details: err instanceof Error ? err.message : 'unknown error',
    };
  }
}

/**
 * Pings Redis with a short timeout. Returns ok + latency on PONG,
 * degraded on error, not_configured if REDIS_URL isn't set.
 */
export async function probeRedis(connectionString?: string): Promise<ProbeResult> {
  if (!connectionString) {
    return { status: 'not_configured' };
  }
  try {
    const { Redis } = await import('ioredis');
    const redis = new Redis(connectionString, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    const start = Date.now();
    try {
      await redis.connect();
      const result = await redis.ping();
      if (result !== 'PONG') {
        await redis.quit();
        return { status: 'degraded', details: `Unexpected ping response: ${result}` };
      }
      await redis.quit();
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (err) {
      try { await redis.quit(); } catch { /* already failed */ }
      return {
        status: 'degraded',
        details: err instanceof Error ? err.message : 'unknown error',
      };
    }
  } catch {
    return { status: 'not_configured', details: 'ioredis not available' };
  }
}
