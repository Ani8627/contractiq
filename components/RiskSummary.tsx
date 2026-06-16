'use client';

import { useEffect, useRef, useState } from 'react';
import { riskColor, riskWeight, scoreToLabel } from '@/lib/risk';
import type { AnalysisRow, ClauseRow, RiskLevel } from '@/lib/types';

interface Props {
  analyses: (AnalysisRow & { clause: ClauseRow })[];
  contractId: string;
}

export default function RiskSummary({ analyses, contractId }: Props) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [loadingBullets, setLoadingBullets] = useState(true);
  const fetchedRef = useRef(false);

  // Weighted overall score
  const validAnalyses = analyses.filter((a) => a.risk_level);
  const overallScore =
    validAnalyses.length > 0
      ? validAnalyses.reduce((sum, a) => sum + riskWeight[a.risk_level as RiskLevel], 0) /
        validAnalyses.length
      : 1;
  const { label: riskLabel, color: riskLabelColor } = scoreToLabel(overallScore);

  // Risk distribution
  const distribution: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const a of validAnalyses) {
    distribution[a.risk_level as RiskLevel]++;
  }

  // Top-3 most dangerous clauses
  const top3 = [...analyses]
    .filter((a) => a.risk_level)
    .sort((a, b) => {
      const rDiff = riskWeight[b.risk_level as RiskLevel] - riskWeight[a.risk_level as RiskLevel];
      if (rDiff !== 0) return rDiff;
      return (b.flags?.length ?? 0) - (a.flags?.length ?? 0);
    })
    .slice(0, 3);

  // By clause type
  const byType: Record<string, { count: number; worst: RiskLevel }> = {};
  for (const a of validAnalyses) {
    const type = a.clause.clause_type ?? 'other';
    if (!byType[type]) byType[type] = { count: 0, worst: 'low' };
    byType[type].count++;
    if (riskWeight[a.risk_level as RiskLevel] > riskWeight[byType[type].worst]) {
      byType[type].worst = a.risk_level as RiskLevel;
    }
  }

  // Fetch 5-bullet summary on mount (once)
  useEffect(() => {
    if (fetchedRef.current || analyses.length === 0) return;
    fetchedRef.current = true;

    const messages = [
      {
        role: 'user' as const,
        content:
          'In exactly 5 short bullet points (start each with "• "), summarize what I am agreeing to in this contract in plain English. Focus on the most important obligations and risks.',
      },
    ];

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contractId, messages }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) { setLoadingBullets(false); return; }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
        }
        const lines = acc.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('•'));
        setBullets(lines);
        setLoadingBullets(false);
      })
      .catch(() => setLoadingBullets(false));
  }, [analyses, contractId]);

  const scoreInt = Math.round((overallScore / 4) * 20); // 0–20 cells

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <h2 className="text-lg font-bold text-gray-900">Risk Summary</h2>

      {/* Overall score gauge */}
      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`text-3xl font-bold ${riskLabelColor}`}>
            {overallScore.toFixed(1)}
          </span>
          <span className="text-sm text-gray-500">/ 4 overall risk</span>
          <span className={`ml-auto text-sm font-semibold ${riskLabelColor}`}>{riskLabel}</span>
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-sm ${
                i < scoreInt
                  ? overallScore >= 3.5
                    ? 'bg-red-500'
                    : overallScore >= 2.5
                      ? 'bg-orange-400'
                      : overallScore >= 1.5
                        ? 'bg-yellow-400'
                        : 'bg-green-500'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Breakdown
        </p>
        <div className="grid grid-cols-2 gap-2">
          {((['critical', 'high', 'medium', 'low'] as RiskLevel[])).map((r) => (
            <div key={r} className={`flex items-center justify-between px-3 py-2 rounded-lg ${riskColor[r]}`}>
              <span className="text-xs font-medium capitalize">{r}</span>
              <span className="text-sm font-bold">{distribution[r]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By type */}
      {Object.keys(byType).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            By Clause Type
          </p>
          <div className="space-y-1">
            {Object.entries(byType).map(([type, { count, worst }]) => (
              <div key={type} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{type.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">{count} clause{count !== 1 ? 's' : ''}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${riskColor[worst]}`}>
                    {worst}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top-3 dangerous clauses */}
      {top3.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Most Concerning Clauses
          </p>
          <div className="space-y-2">
            {top3.map((a) => (
              <div
                key={a.clause_id}
                className="flex items-start gap-2 text-sm"
              >
                <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium capitalize flex-shrink-0 ${riskColor[a.risk_level as RiskLevel]}`}>
                  {a.risk_level}
                </span>
                <span className="text-gray-700">
                  Clause {a.clause.clause_number}
                  {a.clause.clause_type ? ` (${a.clause.clause_type.replace(/_/g, ' ')})` : ''}
                  {a.flags && a.flags.length > 0 ? ` — ${a.flags.slice(0, 2).join(', ')}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5-bullet summary */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          What You&apos;re Agreeing To
        </p>
        {loadingBullets ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="h-3 bg-gray-200 rounded animate-pulse" style={{ width: `${75 + i * 3}%` }} />
            ))}
          </div>
        ) : bullets.length > 0 ? (
          <ul className="space-y-1.5">
            {bullets.map((b, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed">{b}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Summary unavailable</p>
        )}
      </div>
    </div>
  );
}
