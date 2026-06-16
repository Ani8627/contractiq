'use client';

import { useEffect, useRef, useState } from 'react';
import AgentThoughtLog from '@/components/AgentThoughtLog';
import ClauseCard from '@/components/ClauseCard';
import DiffViewer from '@/components/DiffViewer';
import RiskSummary from '@/components/RiskSummary';
import ChatWithContract from '@/components/ChatWithContract';
import { riskColor } from '@/lib/risk';
import type { AnalysisRow, ClauseRow, SSEEvent, RiskLevel } from '@/lib/types';

interface Props {
  contractId: string;
  contractFilename: string;
  initialClauses: ClauseRow[];
  initialAnalyses: AnalysisRow[];
}

type Tab = 'clauses' | 'detail' | 'diff';

export default function ReviewClient({
  contractId,
  contractFilename,
  initialClauses,
  initialAnalyses,
}: Props) {
  const [clauses] = useState<ClauseRow[]>(initialClauses);
  const [analyses, setAnalyses] = useState<Map<string, AnalysisRow>>(
    () => new Map(initialAnalyses.map((a) => [a.clause_id, a])),
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialClauses[0]?.id ?? null,
  );
  const [progress, setProgress] = useState({ current: 0, total: initialClauses.length, type: null as string | null, done: initialAnalyses.length >= initialClauses.length });
  const [summaryData, setSummaryData] = useState<{ overallRisk: number; topFlags: string[]; totalClauses: number } | null>(
    initialAnalyses.length >= initialClauses.length && initialClauses.length > 0
      ? { overallRisk: 0, topFlags: [], totalClauses: initialClauses.length }
      : null,
  );
  const [mobileTab, setMobileTab] = useState<Tab>('clauses');
  const [exportLoading, setExportLoading] = useState<'pdf' | 'markdown' | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const sseAbortRef = useRef<AbortController | null>(null);

  // Start SSE analysis if not already complete
  useEffect(() => {
    if (progress.done) return; // already analyzed
    const alreadyAnalyzed = initialAnalyses.length;
    if (alreadyAnalyzed >= initialClauses.length && initialClauses.length > 0) {
      setProgress((p) => ({ ...p, done: true }));
      return;
    }

    const controller = new AbortController();
    sseAbortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(`/api/analyze?contractId=${contractId}`, {
          signal: controller.signal,
        });

        if (res.status === 429) { setRateLimited(true); return; }
        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          const lines = buf.split('\n\n');
          buf = lines.pop() ?? '';

          for (const chunk of lines) {
            const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;
            const raw = dataLine.slice(6).trim();
            if (raw === '[DONE]') {
              setProgress((p) => ({ ...p, done: true }));
              continue;
            }
            try {
              const event: SSEEvent = JSON.parse(raw);
              if (event.type === 'clause_done') {
                setAnalyses((prev) => {
                  const next = new Map(prev);
                  next.set(event.clauseId, {
                    id: event.clauseId,
                    clause_id: event.clauseId,
                    risk_level: event.analysis.risk_level,
                    plain_english: event.analysis.plain_english,
                    flags: event.analysis.flags,
                    counter_proposal: event.analysis.counter_proposal,
                    rewritten_text: event.analysis.rewritten_text,
                    market_comparison: event.analysis.market_comparison,
                  });
                  return next;
                });
                setProgress((p) => ({
                  ...p,
                  current: event.clauseNumber,
                  type: event.analysis.clause_type,
                }));
              } else if (event.type === 'summary_done') {
                setSummaryData({
                  overallRisk: event.overallRisk,
                  topFlags: event.topFlags,
                  totalClauses: event.totalClauses,
                });
                setProgress((p) => ({ ...p, done: true }));
              }
            } catch {
              // ignore parse errors on incomplete chunks
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[review] SSE error:', err);
        }
      }
    })();

    return () => controller.abort();
  }, [contractId, initialClauses.length, initialAnalyses.length, progress.done]);

  async function exportContract(format: 'pdf' | 'markdown') {
    setExportLoading(format);
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId, format }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = contractFilename.replace(/\.pdf$/i, '') + (format === 'pdf' ? '-annotated.pdf' : '-analysis.md');
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[export]', err);
    } finally {
      setExportLoading(null);
    }
  }

  const selectedClause = clauses.find((c) => c.id === selectedId);
  const selectedAnalysis = selectedId ? analyses.get(selectedId) ?? null : null;
  const analysesWithClauses = clauses
    .map((c) => ({ ...(analyses.get(c.id) ?? { id: c.id, clause_id: c.id, risk_level: null, plain_english: null, flags: null, counter_proposal: null, rewritten_text: null, market_comparison: null }), clause: c }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="font-bold text-gray-900 text-xl truncate max-w-lg">{contractFilename}</h1>
          <p className="text-sm text-gray-500">{clauses.length} clauses</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void exportContract('markdown')}
            disabled={!!exportLoading}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
          >
            {exportLoading === 'markdown' ? 'Exporting…' : '↓ Markdown'}
          </button>
          <button
            onClick={() => void exportContract('pdf')}
            disabled={!!exportLoading}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:border-gray-400 transition-colors disabled:opacity-50"
          >
            {exportLoading === 'pdf' ? 'Exporting…' : '↓ Annotated PDF'}
          </button>
        </div>
      </div>

      {rateLimited && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          Free analysis limit reached. Sign in for 20 analyses per day.
        </div>
      )}

      {/* Mobile tabs */}
      <div className="md:hidden flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        {(['clauses', 'detail', 'diff'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              mobileTab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Desktop three-column / mobile single column */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] gap-4">
        {/* Column 1: clause list */}
        <div className={`md:block ${mobileTab === 'clauses' ? 'block' : 'hidden'}`}>
          <AgentThoughtLog
            current={progress.current}
            total={progress.total}
            currentType={progress.type}
            done={progress.done}
          />
          <div className="space-y-1 max-h-[calc(100vh-12rem)] overflow-y-auto thin-scroll pr-1">
            {clauses.map((c) => {
              const a = analyses.get(c.id);
              const risk = a?.risk_level as RiskLevel | null;
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelectedId(c.id); setMobileTab('detail'); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    c.id === selectedId
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">#{c.clause_number}</span>
                    {risk ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${riskColor[risk]}`}>
                        {risk}
                      </span>
                    ) : (
                      <div className="h-4 w-12 bg-gray-200 rounded-full animate-pulse" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                    {c.original_text.slice(0, 80)}…
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: clause detail */}
        <div className={`md:block ${mobileTab === 'detail' ? 'block' : 'hidden'}`}>
          <div className="space-y-4">
            {selectedClause && (
              <ClauseCard
                clause={selectedClause}
                analysis={selectedAnalysis}
                isSelected
              />
            )}
            {summaryData && (
              <RiskSummary
                analyses={analysesWithClauses}
                contractId={contractId}
              />
            )}
          </div>
        </div>

        {/* Column 3: diff viewer */}
        <div className={`md:block ${mobileTab === 'diff' ? 'block' : 'hidden'}`}>
          {selectedClause && selectedAnalysis?.rewritten_text ? (
            <DiffViewer
              original={selectedClause.original_text}
              rewritten={selectedAnalysis.rewritten_text}
            />
          ) : (
            <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400 text-sm">
              {selectedAnalysis === null
                ? 'Select a clause to see the diff'
                : 'Analysis in progress…'}
            </div>
          )}
        </div>
      </div>

      <ChatWithContract contractId={contractId} />
    </div>
  );
}
