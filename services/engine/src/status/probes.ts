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
 * Redis client is not yet wired into the engine — BullMQ + Redis integration
 * is a hackathon-window task. Until then this returns not_configured.
 */
export async function probeRedis(): Promise<ProbeResult> {
  return { status: 'not_configured' };
}
