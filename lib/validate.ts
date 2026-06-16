import { z } from 'zod';
import type { ClauseAnalysis } from './types';
import { Schema, Type } from '@google/genai';

export class ValidationError extends Error {
  issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(`Validation failed: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Full analysis schema (used after all 5 steps complete)
// ---------------------------------------------------------------------------
const clauseAnalysisSchema = z.object({
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  plain_english: z.string(),
  flags: z.array(z.string()),
  counter_proposal: z.string(),
  rewritten_text: z.string(),
  market_comparison: z.string(),
});

export function validateClauseAnalysis(raw: unknown): ClauseAnalysis {
  const result = clauseAnalysisSchema.safeParse(raw);
  if (!result.success) throw new ValidationError(result.error.issues);
  return result.data;
}

// ---------------------------------------------------------------------------
// Per-step Zod schemas
// ---------------------------------------------------------------------------
export const classifySchema = z.object({
  clause_type: z.enum([
    'termination',
    'liability',
    'ip',
    'payment',
    'nda',
    'indemnification',
    'governing_law',
    'other',
  ]),
});

export const assessSchema = z.object({
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  flags: z.array(z.string()),
  market_comparison: z.string(),
});

export const explainSchema = z.object({
  plain_english: z.string(),
});

export const proposeSchema = z.object({
  counter_proposal: z.string(),
});

export const rewriteSchema = z.object({
  rewritten_text: z.string(),
});

// Segment: wraps string[] in an object because Gemini json_schema root must be an object
export const segmentSchema = z.object({
  clauses: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Matching Gemini responseSchema literals (OpenAPI Schema format)
// ---------------------------------------------------------------------------
export const CLASSIFY_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    clause_type: {
      type: Type.STRING,
      enum: [
        'termination',
        'liability',
        'ip',
        'payment',
        'nda',
        'indemnification',
        'governing_law',
        'other',
      ],
    },
  },
  required: ['clause_type'],
};

export const ASSESS_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    risk_level: {
      type: Type.STRING,
      enum: ['low', 'medium', 'high', 'critical'],
    },
    flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    market_comparison: { type: Type.STRING },
  },
  required: ['risk_level', 'flags', 'market_comparison'],
};

export const EXPLAIN_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    plain_english: { type: Type.STRING },
  },
  required: ['plain_english'],
};

export const PROPOSE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    counter_proposal: { type: Type.STRING },
  },
  required: ['counter_proposal'],
};

export const REWRITE_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    rewritten_text: { type: Type.STRING },
  },
  required: ['rewritten_text'],
};

export const SEGMENT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    clauses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['clauses'],
};
