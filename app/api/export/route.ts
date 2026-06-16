import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { PDFDocument, rgb } from 'pdf-lib';
import type { AnalysisRow, ClauseRow, ContractRow } from '@/lib/types';

export const runtime = 'nodejs';

const bodySchema = z.object({
  contractId: z.string().uuid(),
  format: z.enum(['pdf', 'markdown']),
});

export async function POST(request: NextRequest) {
  let body: { contractId: string; format: 'pdf' | 'markdown' };
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { contractId, format } = body;
  const supabase = createServiceClient();

  // Fetch contract + clauses + analyses
  const { data: contract, error: cErr } = await supabase
    .from('contracts')
    .select('id, filename, storage_path, created_at')
    .eq('id', contractId)
    .single();
  if (cErr || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const { data: clauses, error: clErr } = await supabase
    .from('clauses')
    .select('id, clause_number, original_text, clause_type, page_number')
    .eq('contract_id', contractId)
    .order('clause_number');
  if (clErr || !clauses) {
    return NextResponse.json({ error: 'Failed to load clauses' }, { status: 500 });
  }

  const { data: analyses, error: anErr } = await supabase
    .from('analyses')
    .select(
      'clause_id, risk_level, plain_english, flags, counter_proposal, rewritten_text, market_comparison',
    )
    .in(
      'clause_id',
      (clauses as ClauseRow[]).map((c) => c.id),
    );
  if (anErr) {
    return NextResponse.json({ error: 'Failed to load analyses' }, { status: 500 });
  }

  const analysisMap = new Map(
    (analyses as AnalysisRow[]).map((a) => [a.clause_id, a]),
  );

  // ── Markdown export ───────────────────────────────────────────────────
  if (format === 'markdown') {
    const lines: string[] = [
      `# Contract Analysis: ${(contract as ContractRow).filename}`,
      `**Analyzed:** ${new Date((contract as ContractRow).created_at).toLocaleDateString()}`,
      '',
      '---',
      '',
    ];

    for (const clause of clauses as ClauseRow[]) {
      const analysis = analysisMap.get(clause.id);
      const risk = analysis?.risk_level ?? 'unknown';
      const type = clause.clause_type ?? 'other';

      lines.push(`## Clause ${clause.clause_number} — ${type.toUpperCase()} [${risk.toUpperCase()}]`);
      lines.push('');
      lines.push('**Original Text:**');
      lines.push('');
      lines.push('> ' + clause.original_text.split('\n').join('\n> '));
      lines.push('');

      if (analysis?.flags && analysis.flags.length > 0) {
        lines.push(`**Risk Flags:** ${analysis.flags.map((f) => `\`${f}\``).join(', ')}`);
        lines.push('');
      }

      if (analysis?.market_comparison) {
        lines.push(`**vs. Market Standard:** ${analysis.market_comparison}`);
        lines.push('');
      }

      if (analysis?.plain_english) {
        lines.push(`**Plain English:** ${analysis.plain_english}`);
        lines.push('');
      }

      if (analysis?.counter_proposal) {
        lines.push('**Counter-Proposal:**');
        lines.push('');
        lines.push(analysis.counter_proposal);
        lines.push('');
      }

      if (analysis?.rewritten_text) {
        lines.push('**Rewritten Clause:**');
        lines.push('');
        lines.push('```');
        lines.push(analysis.rewritten_text);
        lines.push('```');
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }

    const markdown = lines.join('\n');
    const safeName = (contract as ContractRow).filename.replace(/[^a-z0-9.-]/gi, '_');
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${safeName}-analysis.md"`,
      },
    });
  }

  // ── PDF export ────────────────────────────────────────────────────────
  const storagePath = (contract as ContractRow).storage_path;
  if (!storagePath) {
    return NextResponse.json(
      { error: 'Original PDF not stored — markdown export only available' },
      { status: 400 },
    );
  }

  const { data: fileData, error: dlError } = await supabase.storage
    .from('contracts')
    .download(storagePath);
  if (dlError || !fileData) {
    return NextResponse.json({ error: 'Failed to download original PDF' }, { status: 500 });
  }

  const originalBytes = Buffer.from(await fileData.arrayBuffer());
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  // Count high/critical clauses
  const highCriticalClauses = (clauses as ClauseRow[]).filter((c) => {
    const a = analysisMap.get(c.id);
    return a?.risk_level === 'high' || a?.risk_level === 'critical';
  });

  // Highlight pages with high/critical clauses
  for (const clause of highCriticalClauses) {
    if (clause.page_number && clause.page_number >= 1 && clause.page_number <= pages.length) {
      const page = pages[clause.page_number - 1];
      const { width, height } = page.getSize();
      // Semi-transparent red overlay over the text area
      page.drawRectangle({
        x: 40,
        y: height * 0.1,
        width: width - 80,
        height: height * 0.8,
        color: rgb(1, 0, 0),
        opacity: 0.08,
        borderColor: rgb(0.8, 0, 0),
        borderOpacity: 0.4,
        borderWidth: 1,
      });
    }
  }

  // Add a risk-count annotation on page 1
  if (pages.length > 0 && highCriticalClauses.length > 0) {
    const firstPage = pages[0];
    const { height } = firstPage.getSize();
    firstPage.drawText(
      `⚠ ${highCriticalClauses.length} high/critical risk clause${highCriticalClauses.length !== 1 ? 's' : ''} flagged`,
      { x: 40, y: height - 30, size: 10, color: rgb(0.8, 0, 0) },
    );
  }

  const pdfBytes = await pdfDoc.save();
  const safeName = (contract as ContractRow).filename.replace(/[^a-z0-9.-]/gi, '_');
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}-annotated.pdf"`,
    },
  });
}
