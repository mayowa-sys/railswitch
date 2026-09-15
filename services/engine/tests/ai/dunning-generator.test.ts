// services/engine/tests/ai/dunning-generator.test.ts
//
// Contract test for the dunning generator. We inject a mock GeminiClient
// so no network calls happen; we assert:
//   1. When AI is disabled, we always get the template fallback verbatim.
//   2. When AI returns valid JSON, we get the generated subject/body.
//   3. When AI returns null / malformed / oversized output, we fall back.

import { describe, it, expect } from 'vitest';
import { generateDunningMessage } from '../../src/ai/dunning-generator.js';
import { GeminiClient } from '../../src/ai/gemini-client.js';

interface MockOptions {
  configured?: boolean;
  reply?: unknown;
  throws?: boolean;
}

function makeMockClient(opts: MockOptions): GeminiClient {
  const client = new GeminiClient({ apiKey: opts.configured === false ? undefined : 'test-key' });
  // Overwrite generateJSON via prototype patch — safe because each test builds a fresh instance.
  (client as unknown as { generateJSON: (input: unknown) => Promise<unknown> }).generateJSON = async () => {
    if (opts.throws) throw new Error('boom');
    return opts.reply as unknown;
  };
  return client;
}

const ctx = {
  channel: 'whatsapp' as const,
  stage: 'va_fallback' as const,
  customerName: 'Ada Lovelace',
  planName: 'Pro',
  amountNaira: 15000,
};

const fallback = {
  subject: 'Fallback subject',
  body: 'Fallback body text',
};

describe('generateDunningMessage', () => {
  it('returns fallback when disabled', async () => {
    const r = await generateDunningMessage(ctx, fallback, { disable: true });
    expect(r.subject).toBe(fallback.subject);
    expect(r.body).toBe(fallback.body);
    expect(r.generated).toBe(false);
  });

  it('returns fallback when client is not configured', async () => {
    const client = makeMockClient({ configured: false });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(false);
    expect(r.body).toBe(fallback.body);
  });

  it('returns generated message when the mock replies with valid JSON', async () => {
    const client = makeMockClient({
      reply: { subject: 'Payment issue', body: 'Hi Ada, your ₦15,000 charge failed.' },
    });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(true);
    expect(r.subject).toBe('Payment issue');
    expect(r.body).toContain('₦15,000');
  });

  it('falls back on null LLM response', async () => {
    const client = makeMockClient({ reply: null });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(false);
    expect(r.body).toBe(fallback.body);
  });

  it('falls back when subject is missing', async () => {
    const client = makeMockClient({ reply: { body: 'no subject here' } });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(false);
  });

  it('falls back when body is missing', async () => {
    const client = makeMockClient({ reply: { subject: 'header' } });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(false);
  });

  it('falls back on oversized body', async () => {
    const client = makeMockClient({
      reply: { subject: 'ok', body: 'x'.repeat(5000) },
    });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(false);
    expect(r.body).toBe(fallback.body);
  });

  it('falls back on oversized subject', async () => {
    const client = makeMockClient({
      reply: { subject: 'x'.repeat(500), body: 'ok' },
    });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.generated).toBe(false);
  });

  it('trims whitespace from generated fields', async () => {
    const client = makeMockClient({
      reply: { subject: '  header  ', body: '\n\nbody\n\n' },
    });
    const r = await generateDunningMessage(ctx, fallback, { client });
    expect(r.subject).toBe('header');
    expect(r.body).toBe('body');
  });
});
