import { createServiceClient, throwIfError } from './supabase';
import { matchClauses } from './retrieval';
import type { AnalysisRow, ClauseRow, RiskLevel } from './types';

const MAX_CONTEXT_CHARS = 16000;

export async function buildChatContext(
  contractId: string,
  question: string,
): Promise<string> {
  const supabase = createServiceClient();

  // 1. Fetch stats header from all clauses + analyses
  const allClauses = throwIfError(
    await supabase
      .from('clauses')
      .select('id, clause_number, clause_type, original_text')
      .eq('contract_id', contractId)
      .order('clause_number'),
  ) as ClauseRow[];

  const analyses = throwIfError(
    await supabase
      .from('analyses')
      .select('clause_id, risk_level, flags, plain_english')
      .in(
        'clause_id',
        allClauses.map((c) => c.id),
      ),
  ) as Pick<AnalysisRow, 'clause_id' | 'risk_level' | 'flags' | 'plain_english'>[];

  const analysisMap = new Map(analyses.map((a) => [a.clause_id, a]));

  // Risk distribution stats
  const riskCounts: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  const allFlags: string[] = [];
  for (const clause of allClauses) {
    const analysis = analysisMap.get(clause.id);
    if (analysis?.risk_level) riskCounts[analysis.risk_level]++;
    if (analysis?.flags) allFlags.push(...analysis.flags);
  }
  const topFlags = Array.from(new Set(allFlags))
    .map((f) => ({ flag: f, count: allFlags.filter((x) => x === f).length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((f) => f.flag);

  const statsHeader =
    `CONTRACT SUMMARY: ${allClauses.length} clauses | ` +
    `Risk: ${riskCounts.critical} critical, ${riskCounts.high} high, ${riskCounts.medium} medium, ${riskCounts.low} low | ` +
    `Top concerns: ${topFlags.join(', ') || 'none identified'}\n\n`;

  // 2. RAG: retrieve the top-6 clauses most relevant to the question
  const matches = await matchClauses(contractId, question, 6);

  // If no embeddings yet (e.g., upload just finished), fall back to first 6 clauses
  const relevantClauses =
    matches.length > 0
      ? matches.map((m) => {
          const analysis = analysisMap.get(m.id);
          return {
            n: m.clause_number,
            type: m.clause_type,
            risk: analysis?.risk_level ?? null,
            flags: analysis?.flags ?? [],
            summary: analysis?.plain_english ?? '',
            excerpt: m.original_text.slice(0, 400),
            similarity: m.similarity.toFixed(2),
          };
        })
      : allClauses.slice(0, 6).map((c) => {
          const analysis = analysisMap.get(c.id);
          return {
            n: c.clause_number,
            type: c.clause_type,
            risk: analysis?.risk_level ?? null,
            flags: analysis?.flags ?? [],
            summary: analysis?.plain_english ?? '',
            excerpt: c.original_text.slice(0, 400),
            similarity: null,
          };
        });

  let clauseJson = JSON.stringify(relevantClauses, null, 2);

  // 3. Trim if over budget (drop excerpts first, then summaries from low-risk)
  if (statsHeader.length + clauseJson.length > MAX_CONTEXT_CHARS) {
    const trimmed = relevantClauses.map((c) => ({ ...c, excerpt: '' }));
    clauseJson = JSON.stringify(trimmed, null, 2);
  }
  if (statsHeader.length + clauseJson.length > MAX_CONTEXT_CHARS) {
    const trimmed = relevantClauses.map((c) =>
      c.risk === 'low' ? { ...c, excerpt: '', summary: '' } : { ...c, excerpt: '' },
    );
    clauseJson = JSON.stringify(trimmed, null, 2);
  }

  return statsHeader + 'RELEVANT CLAUSES:\n' + clauseJson;
}
