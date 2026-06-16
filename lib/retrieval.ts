import { createServiceClient } from './supabase';
import { embedText } from './embeddings';
import type { ClauseMatch, LibraryMatch } from './types';

// Semantic search over a contract's clauses — used by RAG chat
export async function matchClauses(
  contractId: string,
  query: string,
  k = 6,
): Promise<ClauseMatch[]> {
  try {
    const embedding = await embedText(query);
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('match_clauses', {
      query_embedding: embedding,
      p_contract_id: contractId,
      match_count: k,
    });
    if (error) throw new Error(error.message);
    return (data as ClauseMatch[]) ?? [];
  } catch (err) {
    console.error('[retrieval] matchClauses failed:', err);
    return [];
  }
}

// Semantic search over benchmark library — used by assess/propose steps
export async function matchLibrary(
  clauseText: string,
  clauseType: string,
  k = 2,
): Promise<LibraryMatch[]> {
  try {
    const embedding = await embedText(clauseText);
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('match_library', {
      query_embedding: embedding,
      p_clause_type: clauseType,
      match_count: k,
    });
    if (error) throw new Error(error.message);
    return (data as LibraryMatch[]) ?? [];
  } catch (err) {
    // Fail gracefully — analysis works without benchmarks (ungrounded mode)
    console.warn('[retrieval] matchLibrary failed (degrading to ungrounded):', err);
    return [];
  }
}
