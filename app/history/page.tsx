import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createServerComponentClient, createServiceClient } from '@/lib/supabase';
import { riskColor, scoreToLabel, riskWeight } from '@/lib/risk';
import type { ContractRow, AnalysisRow, ClauseRow, RiskLevel } from '@/lib/types';

export default async function HistoryPage() {
  // Auth gate
  const serverClient = createServerComponentClient();
  const { data: authData } = await serverClient.auth.getUser();
  if (!authData.user) redirect('/');

  const supabase = createServiceClient();
  const userId = authData.user.id;

  // Fetch user's contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, filename, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const contractList = (contracts ?? []) as ContractRow[];

  // Fetch clause counts + analyses for all contracts
  const contractIds = contractList.map((c) => c.id);
  const { data: clauses } = await supabase
    .from('clauses')
    .select('id, contract_id')
    .in('contract_id', contractIds);
  const clauseList = (clauses ?? []) as ClauseRow[];

  const clauseIdsByContract = new Map<string, string[]>();
  for (const c of clauseList) {
    const existing = clauseIdsByContract.get(c.contract_id) ?? [];
    existing.push(c.id);
    clauseIdsByContract.set(c.contract_id, existing);
  }

  const allClauseIds = clauseList.map((c) => c.id);
  const { data: analyses } = await supabase
    .from('analyses')
    .select('clause_id, risk_level')
    .in('clause_id', allClauseIds);
  const analysisList = (analyses ?? []) as Pick<AnalysisRow, 'clause_id' | 'risk_level'>[];

  const analysisMap = new Map(analysisList.map((a) => [a.clause_id, a.risk_level as RiskLevel]));

  function contractRisk(contractId: string): number {
    const clauseIds = clauseIdsByContract.get(contractId) ?? [];
    const scores = clauseIds
      .map((id) => analysisMap.get(id))
      .filter(Boolean)
      .map((r) => riskWeight[r as RiskLevel]);
    if (scores.length === 0) return 0;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Contract History</h1>

      {contractList.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No contracts yet.</p>
          <Link href="/" className="text-blue-600 hover:underline">
            Analyze your first contract →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {contractList.map((c) => {
            const clauseCount = clauseIdsByContract.get(c.id)?.length ?? 0;
            const risk = contractRisk(c.id);
            const { label: riskLabel, color: riskLabelColor } = scoreToLabel(risk);
            const riskBadgeLevel: RiskLevel =
              risk >= 3.5 ? 'critical' : risk >= 2.5 ? 'high' : risk >= 1.5 ? 'medium' : 'low';

            return (
              <Link
                key={c.id}
                href={`/review/${c.id}`}
                className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{c.filename}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(c.created_at).toLocaleDateString()} · {clauseCount} clause
                      {clauseCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {risk > 0 ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${riskLabelColor}`}>
                        {risk.toFixed(1)}/4
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${riskColor[riskBadgeLevel]}`}>
                        {riskLabel}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">analyzing…</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
