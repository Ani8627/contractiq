'use client';

import { riskColor } from '@/lib/risk';
import type { ClauseRow, AnalysisRow, RiskLevel } from '@/lib/types';

interface Props {
  clause: ClauseRow;
  analysis: AnalysisRow | null;
  isSelected: boolean;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className ?? 'h-4 w-full'}`} />;
}

export default function ClauseCard({ clause, analysis, isSelected }: Props) {
  const risk = analysis?.risk_level as RiskLevel | null;
  const flags = analysis?.flags ?? [];

  return (
    <div
      className={`
        rounded-xl border p-5 transition-shadow
        ${isSelected ? 'border-blue-400 shadow-md shadow-blue-100' : 'border-gray-200 shadow-sm'}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-700">
          Clause {clause.clause_number}
        </span>
        {clause.clause_type && (
          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-full capitalize">
            {clause.clause_type.replace(/_/g, ' ')}
          </span>
        )}
        {risk ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${riskColor[risk]}`}>
            {risk}
          </span>
        ) : (
          <Skeleton className="h-5 w-16 rounded-full" />
        )}
      </div>

      {/* Original text */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-48 overflow-y-auto thin-scroll">
        <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
          {clause.original_text}
        </p>
      </div>

      {/* Plain English */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Plain English
        </p>
        {analysis?.plain_english ? (
          <p className="text-sm text-gray-800 leading-relaxed">{analysis.plain_english}</p>
        ) : (
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-4/6" />
          </div>
        )}
      </div>

      {/* Flags */}
      {analysis !== null && flags.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Risk Flags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span
                key={f}
                className="text-xs px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* vs. Market Standard — the RAG-grounded signature feature */}
      {analysis?.market_comparison && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1 flex items-center gap-1">
            <span>⚖</span> vs. Market Standard
          </p>
          <p className="text-sm text-amber-900 leading-relaxed">
            {analysis.market_comparison}
          </p>
        </div>
      )}

      {/* Counter-proposal */}
      {analysis?.counter_proposal ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
            Counter-Proposal
          </p>
          <p className="text-sm text-blue-900 leading-relaxed">
            {analysis.counter_proposal}
          </p>
        </div>
      ) : analysis === null ? (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <Skeleton className="h-3.5 w-4/5 mb-1.5" />
          <Skeleton className="h-3.5 w-3/5" />
        </div>
      ) : null}
    </div>
  );
}
