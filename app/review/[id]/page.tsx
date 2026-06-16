import { notFound } from 'next/navigation';
import { createServiceClient, createServerComponentClient } from '@/lib/supabase';
import ReviewClient from './ReviewClient';
import type { ClauseRow, AnalysisRow, ContractRow } from '@/lib/types';

interface Props {
  params: { id: string };
}

export default async function ReviewPage({ params }: Props) {
  const { id } = params;
  const supabase = createServiceClient();

  // Fetch contract
  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select('id, user_id, filename, created_at')
    .eq('id', id)
    .single();

  if (cErr || !contract) notFound();

  const contractRow = contract as ContractRow;

  // Ownership check: if contract belongs to a user, verify the session
  if (contractRow.user_id !== null) {
    try {
      const serverClient = createServerComponentClient();
      const { data: authData } = await serverClient.auth.getUser();
      const sessionUserId = authData.user?.id ?? null;
      if (sessionUserId !== contractRow.user_id) {
        return new Response('Forbidden', { status: 403 }) as unknown as React.ReactElement;
      }
    } catch {
      return new Response('Forbidden', { status: 403 }) as unknown as React.ReactElement;
    }
  }

  // Fetch clauses + existing analyses
  const { data: clauses } = await supabase
    .from('clauses')
    .select('id, contract_id, clause_number, original_text, clause_type, page_number')
    .eq('contract_id', id)
    .order('clause_number');

  const clauseList = (clauses ?? []) as ClauseRow[];

  const { data: analyses } = await supabase
    .from('analyses')
    .select(
      'id, clause_id, risk_level, plain_english, flags, counter_proposal, rewritten_text, market_comparison',
    )
    .in(
      'clause_id',
      clauseList.map((c) => c.id),
    );

  const analysisList = (analyses ?? []) as AnalysisRow[];

  return (
    <ReviewClient
      contractId={id}
      contractFilename={contractRow.filename}
      initialClauses={clauseList}
      initialAnalyses={analysisList}
    />
  );
}
