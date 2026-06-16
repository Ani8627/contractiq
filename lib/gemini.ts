import { GoogleGenAI, Schema } from '@google/genai';
import { z } from 'zod';
import { ValidationError } from './validate';

// Quality rule #1 — single source of truth for model names
export const MODEL = 'gemini-2.5-flash';
export const EMBED_MODEL = 'gemini-embedding-001';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// ---------------------------------------------------------------------------
// Free-tier serial queue with pacing
// Gemini free tier ≈ 10 RPM. Every call passes through this queue so we
// never fire faster than GEMINI_MIN_INTERVAL_MS between request starts.
// Set GEMINI_MIN_INTERVAL_MS=0 on a paid key to disable pacing.
// ---------------------------------------------------------------------------
const MIN_INTERVAL = parseInt(process.env.GEMINI_MIN_INTERVAL_MS ?? '6500', 10);

let _queueTail: Promise<void> = Promise.resolve();
let _lastRequestAt = 0;

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = _queueTail.then(async () => {
    if (MIN_INTERVAL > 0) {
      const elapsed = Date.now() - _lastRequestAt;
      if (elapsed < MIN_INTERVAL) {
        await sleep(MIN_INTERVAL - elapsed);
      }
    }
    _lastRequestAt = Date.now();
    return fn();
  });
  // Drain errors from the tail so the queue doesn't stall on failure
  _queueTail = result.then(
    () => {},
    () => {},
  );
  return result;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// 429 retry with exponential backoff
// ---------------------------------------------------------------------------
async function withBackoff<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const isQuota = isQuotaError(err);
    if (isQuota && attempt < 4) {
      const delay = Math.min(5000 * Math.pow(2, attempt), 60000);
      await sleep(delay);
      return withBackoff(fn, attempt + 1);
    }
    throw err;
  }
}

function isQuotaError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const msg = String((err as { message?: string }).message ?? '');
  return msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
}

// ---------------------------------------------------------------------------
// callJson — structured generation used by the agent pipeline
// ---------------------------------------------------------------------------
export async function callJson<T>(opts: {
  system: string;
  user: string;
  zodSchema: z.ZodType<T>;
  responseSchema: Schema;
  maxOutputTokens?: number;
}): Promise<T> {
  return enqueue(() => withBackoff(() => _callJson(opts)));
}

async function _callJson<T>(opts: {
  system: string;
  user: string;
  zodSchema: z.ZodType<T>;
  responseSchema: Schema;
  maxOutputTokens?: number;
}): Promise<T> {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: opts.user,
    config: {
      systemInstruction: opts.system,
      responseMimeType: 'application/json',
      responseSchema: opts.responseSchema,
      thinkingConfig: { thinkingBudget: 0 }, // off for pipeline steps — faster JSON extraction
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
    },
  });

  const text = response.text ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError([
      { code: 'custom', message: `Invalid JSON from model: ${text.slice(0, 200)}`, path: [] },
    ]);
  }

  const result = opts.zodSchema.safeParse(parsed);
  if (!result.success) throw new ValidationError(result.error.issues);
  return result.data;
}

// Retry wrapper used by agent.ts — retries once then re-throws
export async function callJsonWithRetry<T>(opts: {
  system: string;
  user: string;
  zodSchema: z.ZodType<T>;
  responseSchema: Schema;
  maxOutputTokens?: number;
}): Promise<T> {
  try {
    return await callJson<T>(opts);
  } catch (err) {
    if (err instanceof ValidationError) {
      // one retry with the same prompt
      return callJson<T>(opts);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// streamText — used by the chat endpoint
// ---------------------------------------------------------------------------
export interface StreamTextOpts {
  system: string;
  user: string;
  history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
}

export async function* streamText(opts: StreamTextOpts): AsyncIterable<string> {
  const contents = [
    ...(opts.history ?? []),
    { role: 'user' as const, parts: [{ text: opts.user }] },
  ];

  const stream = await enqueue(() =>
    withBackoff(() =>
      ai.models.generateContentStream({
        model: MODEL,
        contents,
        config: {
          systemInstruction: opts.system,
          maxOutputTokens: 2048,
          // thinking config: default (let model decide) — better quality for chat
        },
      }),
    ),
  );

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}
