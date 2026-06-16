/**
 * One-time script: embed all clause_library rows that have no embedding yet.
 * Run after applying seed_library.sql:
 *   npx tsx scripts/embed-library.ts
 *
 * Also re-run after adding new library entries.
 */
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const geminiKey = process.env.GEMINI_API_KEY ?? '';

if (!supabaseUrl || !serviceKey || !geminiKey) {
  console.error(
    'Missing env vars. Ensure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are set.',
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const ai = new GoogleGenAI({ apiKey: geminiKey });

const EMBED_MODEL = 'gemini-embedding-001';
const MIN_INTERVAL = parseInt(process.env.GEMINI_MIN_INTERVAL_MS ?? '6500', 10);

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function embedText(text: string): Promise<number[]> {
  const response = await ai.models.embedContent({
    model: EMBED_MODEL,
    contents: text.slice(0, 8000),
    config: { outputDimensionality: 768 },
  });
  const values = response.embeddings?.[0]?.values;
  if (!values || values.length !== 768) throw new Error(`Bad embedding: ${values?.length} dims`);
  return values;
}

async function main() {
  console.log('Fetching unembedded library entries…');
  const { data: rows, error } = await supabase
    .from('clause_library')
    .select('id, title, standard_text, guidance')
    .is('embedding', null);

  if (error) {
    console.error('Failed to fetch rows:', error.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('All library entries already have embeddings. Done.');
    return;
  }

  console.log(`Embedding ${rows.length} entries…`);
  let last = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as { id: string; title: string; standard_text: string; guidance: string };

    // Respect free-tier pacing
    if (MIN_INTERVAL > 0) {
      const elapsed = Date.now() - last;
      if (elapsed < MIN_INTERVAL) await sleep(MIN_INTERVAL - elapsed);
    }
    last = Date.now();

    try {
      // Embed the concatenation of standard_text + guidance for richer matching
      const embedding = await embedText(`${row.standard_text}\n\n${row.guidance}`);

      const { error: updateError } = await supabase
        .from('clause_library')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', row.id);

      if (updateError) {
        console.error(`  ✗ ${row.title}: ${updateError.message}`);
      } else {
        console.log(`  ✓ [${i + 1}/${rows.length}] ${row.title}`);
      }
    } catch (err) {
      console.error(`  ✗ ${row.title}:`, err);
    }
  }

  console.log('Done.');
}

void main();
