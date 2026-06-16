import { NextRequest } from 'next/server';
import { createServiceClient, createServerComponentClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { runAgentLoop } from '@/lib/agent';
import type { ClauseRow, SSEEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');

  if (!contractId) {
    return new Response(JSON.stringify({ error: 'contractId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Rate limiting ─────────────────────────────────────────────────────
  let userId: string | null = null;
  try {
    const serverClient = createServerComponentClient();
    const { data } = await serverClient.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // unauthenticated
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const identifier = userId ?? ip;
  const rateResult = await checkRateLimit(identifier, !!userId);

  if (!rateResult.success) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((rateResult.reset - Date.now()) / 1000)),
      },
    });
  }

  // ── Fetch contract + clauses ──────────────────────────────────────────
  const supabase = createServiceClient();
  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id')
    .eq('id', contractId)
    .single();

  if (contractError || !contract) {
    return new Response(JSON.stringify({ error: 'Contract not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: clausesData, error: clausesError } = await supabase
    .from('clauses')
    .select('id, contract_id, clause_number, original_text, clause_type, page_number')
    .eq('contract_id', contractId)
    .order('clause_number');

  if (clausesError || !clausesData) {
    return new Response(JSON.stringify({ error: 'Failed to load clauses' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const clauses = clausesData as ClauseRow[];

  // ── SSE stream ────────────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Quality rule #5 — heartbeat every 15s keeps stream alive through
      // the Gemini free-tier pacing waits (Vercel kills idle at 30s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      request.signal.addEventListener('abort', () => clearInterval(heartbeat));

      try {
        await runAgentLoop(contractId, clauses, (e: SSEEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        });
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`,
          ),
        );
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
