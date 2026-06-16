import { createServiceClient } from './supabase';
import { callJsonWithRetry } from './gemini';
import { validateClauseAnalysis, ValidationError } from './validate';
import { z } from 'zod';
import {
  classifySchema,
  assessSchema,
  explainSchema,
  proposeSchema,
  rewriteSchema,
  CLASSIFY_RESPONSE_SCHEMA,
  ASSESS_RESPONSE_SCHEMA,
  EXPLAIN_RESPONSE_SCHEMA,
  PROPOSE_RESPONSE_SCHEMA,
  REWRITE_RESPONSE_SCHEMA,
} from './validate';

type ClassifyResult = z.infer<typeof classifySchema>;
type AssessResult = z.infer<typeof assessSchema>;
type ExplainResult = z.infer<typeof explainSchema>;
type ProposeResult = z.infer<typeof proposeSchema>;
type RewriteResult = z.infer<typeof rewriteSchema>;
import {
  CLASSIFY_PROMPT,
  ASSESS_PROMPT,
  EXPLAIN_PROMPT,
  PROPOSE_PROMPT,
  REWRITE_PROMPT,
} from './prompts';
import { matchLibrary } from './retrieval';
import type { ClauseRow, SSEEvent, RiskLevel } from './types';

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export async function runAgentLoop(
  contractId: string,
  clauses: ClauseRow[],
  onEvent: (e: SSEEvent) => void,
): Promise<void> {
  const supabase = createServiceClient();
  const riskScores: number[] = [];
  const allFlags: string[] = [];

  for (const clause of clauses) {
    const clauseText = clause.original_text;
    let clauseType = clause.clause_type ?? 'other';
    let riskLevel: RiskLevel = 'medium';
    let flags: string[] = [];
    let plainEnglish = '';
    let counterProposal = '';
    let rewrittenText = '';
    let marketComparison = '';
    let failed = false;

    try {
      // ── Step 1: Classify ──────────────────────────────────────────────────
      const classified = await callJsonWithRetry<ClassifyResult>({
        system: CLASSIFY_PROMPT,
        user: clauseText,
        zodSchema: classifySchema,
        responseSchema: CLASSIFY_RESPONSE_SCHEMA,
      });
      clauseType = classified.clause_type;
      await supabase
        .from('clauses')
        .update({ clause_type: clauseType })
        .eq('id', clause.id);

      // ── Step 2: Retrieve benchmarks ───────────────────────────────────────
      const benchmarks = await matchLibrary(clauseText, clauseType, 2);
      const benchmarkBlock =
        benchmarks.length > 0
          ? '\n\nMARKET BENCHMARKS:\n' +
            benchmarks
              .map(
                (b) =>
                  `TITLE: ${b.title}\nSTANDARD TEXT: ${b.standard_text}\nGUIDANCE: ${b.guidance}`,
              )
              .join('\n---\n')
          : '';

      // ── Step 3: Assess ────────────────────────────────────────────────────
      const assessed = await callJsonWithRetry<AssessResult>({
        system: ASSESS_PROMPT,
        user: `CLAUSE:\n${clauseText}${benchmarkBlock}`,
        zodSchema: assessSchema,
        responseSchema: ASSESS_RESPONSE_SCHEMA,
      });
      riskLevel = assessed.risk_level;
      flags = assessed.flags;
      marketComparison = assessed.market_comparison;

      // ── Step 4: Explain ───────────────────────────────────────────────────
      const explained = await callJsonWithRetry<ExplainResult>({
        system: EXPLAIN_PROMPT,
        user: clauseText,
        zodSchema: explainSchema,
        responseSchema: EXPLAIN_RESPONSE_SCHEMA,
      });
      plainEnglish = explained.plain_english;

      // ── Step 5: Propose ───────────────────────────────────────────────────
      const proposed = await callJsonWithRetry<ProposeResult>({
        system: PROPOSE_PROMPT,
        user:
          `CLAUSE:\n${clauseText}\n\nRISK LEVEL: ${riskLevel}\nFLAGS: ${flags.join(', ')}${benchmarkBlock}`,
        zodSchema: proposeSchema,
        responseSchema: PROPOSE_RESPONSE_SCHEMA,
      });
      counterProposal = proposed.counter_proposal;

      // ── Step 6: Rewrite ───────────────────────────────────────────────────
      const rewritten = await callJsonWithRetry<RewriteResult>({
        system: REWRITE_PROMPT,
        user: `CLAUSE TYPE: ${clauseType}\nRISK FLAGS: ${flags.join(', ')}\n\nCLAUSE:\n${clauseText}`,
        zodSchema: rewriteSchema,
        responseSchema: REWRITE_RESPONSE_SCHEMA,
      });
      rewrittenText = rewritten.rewritten_text;
    } catch (err) {
      // Terminal failure after retry — degrade gracefully, continue to next clause
      console.error(`[agent] Clause ${clause.clause_number} failed:`, err);
      if (!(err instanceof ValidationError)) {
        console.error('[agent] Non-validation error:', err);
      }
      failed = true;
      riskLevel = 'medium';
      flags = ['analysis_failed'];
      marketComparison = '';
      plainEnglish = '';
      counterProposal = '';
      rewrittenText = '';
    }

    // Upsert analysis row
    await supabase.from('analyses').upsert(
      {
        clause_id: clause.id,
        risk_level: riskLevel,
        flags: flags,
        plain_english: plainEnglish,
        counter_proposal: counterProposal,
        rewritten_text: rewrittenText,
        market_comparison: marketComparison,
      },
      { onConflict: 'clause_id' },
    );

    // Validate accumulated object before emitting (skip for failed clauses)
    if (!failed) {
      try {
        validateClauseAnalysis({
          risk_level: riskLevel,
          plain_english: plainEnglish,
          flags,
          counter_proposal: counterProposal,
          rewritten_text: rewrittenText,
          market_comparison: marketComparison,
        });
      } catch {
        // Validation of accumulated object failed — still emit but flag it
        flags = [...flags, 'validation_warning'];
      }
    }

    riskScores.push(RISK_WEIGHTS[riskLevel]);
    allFlags.push(...flags.filter((f) => f !== 'analysis_failed'));

    onEvent({
      type: 'clause_done',
      clauseId: clause.id,
      clauseNumber: clause.clause_number,
      analysis: {
        risk_level: riskLevel,
        plain_english: plainEnglish,
        flags,
        counter_proposal: counterProposal,
        rewritten_text: rewrittenText,
        market_comparison: marketComparison,
        clause_type: clauseType,
      },
    });
  }

  // Final summary
  const overallRisk =
    riskScores.length > 0
      ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
      : 1;

  const flagFreq = new Map<string, number>();
  for (const f of allFlags) {
    flagFreq.set(f, (flagFreq.get(f) ?? 0) + 1);
  }
  const topFlags = Array.from(flagFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f]) => f);

  onEvent({
    type: 'summary_done',
    overallRisk: Math.round(overallRisk * 10) / 10,
    topFlags,
    totalClauses: clauses.length,
  });
}
