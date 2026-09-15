// services/engine/tests/ai/gemini-client.test.ts
//
// Test the tiny Gemini HTTP shim. We inject a fake fetch — no real network.

import { describe, it, expect, vi } from 'vitest';
import { GeminiClient } from '../../src/ai/gemini-client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GeminiClient', () => {
  it('reports unconfigured when no api key present', () => {
    const c = new GeminiClient({ apiKey: undefined });
    expect(c.isConfigured()).toBe(false);
  });

  it('parses a valid Gemini response into JSON', async () => {
    const fake = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: { parts: [{ text: JSON.stringify({ hello: 'world' }) }] },
          },
        ],
      }),
    );
    const c = new GeminiClient({ apiKey: 'k', fetchImpl: fake as unknown as typeof fetch });
    const r = await c.generateJSON<{ hello: string }>({ userPrompt: 'hi' });
    expect(r).toEqual({ hello: 'world' });
  });

  it('returns null on non-2xx', async () => {
    const fake = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));
    const c = new GeminiClient({ apiKey: 'k', fetchImpl: fake as unknown as typeof fetch });
    const r = await c.generateJSON({ userPrompt: 'hi' });
    expect(r).toBeNull();
  });

  it('returns null when response text is unparseable', async () => {
    const fake = vi.fn().mockResolvedValue(
      jsonResponse({
        candidates: [{ content: { parts: [{ text: 'not-json' }] } }],
      }),
    );
    const c = new GeminiClient({ apiKey: 'k', fetchImpl: fake as unknown as typeof fetch });
    const r = await c.generateJSON({ userPrompt: 'hi' });
    expect(r).toBeNull();
  });

  it('returns null when candidates are missing', async () => {
    const fake = vi.fn().mockResolvedValue(jsonResponse({}));
    const c = new GeminiClient({ apiKey: 'k', fetchImpl: fake as unknown as typeof fetch });
    const r = await c.generateJSON({ userPrompt: 'hi' });
    expect(r).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    const fake = vi.fn().mockRejectedValue(new Error('network'));
    const c = new GeminiClient({ apiKey: 'k', fetchImpl: fake as unknown as typeof fetch });
    const r = await c.generateJSON({ userPrompt: 'hi' });
    expect(r).toBeNull();
  });

  it('short-circuits when unconfigured — never calls fetch', async () => {
    const fake = vi.fn();
    const c = new GeminiClient({ apiKey: undefined, fetchImpl: fake as unknown as typeof fetch });
    const r = await c.generateJSON({ userPrompt: 'hi' });
    expect(r).toBeNull();
    expect(fake).not.toHaveBeenCalled();
  });
});
