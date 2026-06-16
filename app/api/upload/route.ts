import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerComponentClient } from '@/lib/supabase';
import { segmentClauses } from '@/lib/segment';
import { embedBatch } from '@/lib/embeddings';
import type { UploadResponse } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file field is required' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File must be under 10 MB' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // ── Parse PDF ─────────────────────────────────────────────────────────
    // Import the lib entry-point directly to avoid the debug-block ENOENT crash
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (
      buf: Buffer,
      options?: object,
    ) => Promise<{ text: string; numpages: number }>;

    const pages: string[] = [];
    const pdfData = await pdfParse(buf, {
      pagerender: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) =>
        pageData.getTextContent().then((content) => {
          const text = content.items.map((i) => i.str).join(' ');
          pages.push(text);
          return text;
        }),
    });
    const rawText = pdfData.text;

    // ── Segment clauses ───────────────────────────────────────────────────
    const clauseTexts = await segmentClauses(rawText);

    // ── Resolve user ──────────────────────────────────────────────────────
    let userId: string | null = null;
    try {
      const serverClient = createServerComponentClient();
      const {
        data: { session },
      } = await serverClient.auth.getSession();
      userId = session?.user?.id ?? null;
    } catch {
      // unauthenticated upload is fine
    }

    const supabase = createServiceClient();

    // ── Store original PDF ────────────────────────────────────────────────
    const contractUuid = crypto.randomUUID();
    const storagePath = `${contractUuid}.pdf`;
   const uploadResult = await supabase.storage
  .from('contracts')
  .upload(storagePath, buf, {
    contentType: 'application/pdf',
    upsert: false,
  });

console.log("UPLOAD RESULT:", uploadResult);

    // ── Insert contract ───────────────────────────────────────────────────
    const { data: contractData, error: contractError } = await supabase
      .from('contracts')
      .insert({
        id: contractUuid,
        user_id: userId,
        filename: file.name,
        raw_text: rawText,
        storage_path: storagePath,
      })
      .select('id')
      .single();

    if (contractError || !contractData) {
      throw new Error(`Failed to insert contract: ${contractError?.message}`);
    }
    const contractId = contractData.id as string;

    // ── Insert clauses ────────────────────────────────────────────────────
    const clauseRows = clauseTexts.map((text, i) => {
      // Find which page this clause likely belongs to
      const firstLine = text.slice(0, 80);
      const pageIdx = pages.findIndex((p) => p.includes(firstLine));
      return {
        contract_id: contractId,
        clause_number: i + 1,
        original_text: text,
        clause_type: null,
        page_number: pageIdx >= 0 ? pageIdx + 1 : null,
      };
    });

    const { data: insertedClauses, error: clauseError } = await supabase
      .from('clauses')
      .insert(clauseRows)
      .select('id, clause_number, original_text');

    if (clauseError || !insertedClauses) {
      throw new Error(`Failed to insert clauses: ${clauseError?.message}`);
    }

    // ── Embed clauses (async, fail-safe) ──────────────────────────────────
    // Fire-and-forget embedding with error isolation so it never fails the upload
    void (async () => {
      try {
        const texts = (insertedClauses as Array<{ id: string; original_text: string }>).map(
          (c) => c.original_text,
        );
        const embeddings = await embedBatch(texts);
        for (let i = 0; i < insertedClauses.length; i++) {
          await supabase
            .from('clauses')
            .update({ embedding: JSON.stringify(embeddings[i]) })
            .eq('id', (insertedClauses[i] as { id: string }).id);
        }
      } catch (err) {
        console.error('[upload] Embedding failed (non-fatal):', err);
      }
    })();

    const response: UploadResponse = {
      contractId,
      clauseCount: clauseRows.length,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error('[upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
