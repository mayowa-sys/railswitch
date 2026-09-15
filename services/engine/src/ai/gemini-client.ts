// services/engine/src/ai/gemini-client.ts
//
// Minimal Gemini API client. Uses Google's public generativelanguage.googleapis.com
// REST endpoint — no SDK dependency, just fetch. Free tier (gemini-2.0-flash)
// gives ~1500 requests/day and 1M tokens/min, which is more than enough for
// personalized dunning messages at hackathon scale.
//
// The client is deliberately narrow: one method (`generateJSON`) that returns
// parsed JSON. Anything richer belongs in the caller. Everything degrades to
// null on failure so the caller can fall back to a template.

import { GlobalLogger } from '../utils/logger.js';

const DEFAULT_MODEL = 'gemini-3.6-flash';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_TIMEOUT_MS = 8000;

export interface GeminiClientOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface GenerateJSONInput {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export class GeminiClient {
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly logger = new GlobalLogger('GeminiClient');

  constructor(opts: GeminiClientOptions = {}) {
    this.apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Returns the parsed JSON reply, or null on any failure (network, timeout,
   * non-2xx, unparseable body). Callers must have a template fallback.
   */
  async generateJSON<T>(input: GenerateJSONInput): Promise<T | null> {
    if (!this.apiKey) {
      this.logger.debug('Gemini not configured; skipping generation');
      return null;
    }

    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: input.userPrompt }],
        },
      ],
      systemInstruction: input.systemPrompt
        ? { role: 'system', parts: [{ text: input.systemPrompt }] }
        : undefined,
      generationConfig: {
        temperature: input.temperature ?? 0.4,
        // gemini-3.x is a thinking model; internal reasoning tokens are
        // counted against maxOutputTokens. We do not need reasoning for a
        // short dunning message, so we disable it and set a generous cap.
        maxOutputTokens: input.maxOutputTokens ?? 2048,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.warn('Gemini non-2xx', { status: res.status, body: text.slice(0, 200) });
        return null;
      }
      const raw = await res.json() as GeminiResponse;
      const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        this.logger.warn('Gemini response missing text');
        return null;
      }
      return JSON.parse(text) as T;
    } catch (err) {
      this.logger.warn('Gemini call failed', { error: (err as Error).message });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

let _instance: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!_instance) {
    _instance = new GeminiClient();
  }
  return _instance;
}

/** Test seam: reset the singleton (used by unit tests). */
export function resetGeminiClient() {
  _instance = null;
}
