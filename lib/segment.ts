import { callJson } from './gemini';
import { segmentSchema, SEGMENT_RESPONSE_SCHEMA } from './validate';
import { SEGMENT_PROMPT } from './prompts';

const MIN_CHUNK_CHARS = 80;
const AMBIGUOUS_THRESHOLD = 1200;

// Patterns that indicate a clause heading at the start of a line
const HEADING_PATTERNS = [
  /^\d+\.\s/m, // "1. "
  /^SECTION\s/im, // "SECTION "
  /^Article\s/im, // "Article "
  /^[A-Z][A-Z\s\d.,&()-]{4,}[A-Z]\s*$/m, // ALL-CAPS heading
];

function hasHeading(chunk: string): boolean {
  return HEADING_PATTERNS.some((p) => p.test(chunk));
}

function isAmbiguous(chunk: string): boolean {
  return !hasHeading(chunk) && chunk.length > AMBIGUOUS_THRESHOLD;
}

export async function segmentClauses(text: string): Promise<string[]> {
  // ─── Pass 1: regex splitting ────────────────────────────────────────────
  const splits = text
    .split(/(?=(?:^\d+\.\s|^SECTION\s|^Article\s|^[A-Z][A-Z\s\d.,&()-]{4,}[A-Z]\s*$))/m)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_CHUNK_CHARS);

  if (splits.length === 0) {
    // No structure found — treat the whole text as one clause
    return [text.trim()].filter((s) => s.length >= MIN_CHUNK_CHARS);
  }

  // ─── Pass 2: Claude-split ambiguous chunks ───────────────────────────────
  const results: string[] = [];
  for (const chunk of splits) {
    if (!isAmbiguous(chunk)) {
      results.push(chunk);
      continue;
    }

    try {
      const parsed = await callJson({
        system: SEGMENT_PROMPT,
        user: chunk,
        zodSchema: segmentSchema,
        responseSchema: SEGMENT_RESPONSE_SCHEMA,
        maxOutputTokens: 4096,
      });
      const subclauses = parsed.clauses
        .map((s: string) => s.trim())
        .filter((s: string) => s.length >= MIN_CHUNK_CHARS);
      if (subclauses.length > 0) {
        results.push(...subclauses);
      } else {
        results.push(chunk); // fallback: keep whole chunk
      }
    } catch {
      results.push(chunk); // never lose text on failure
    }
  }

  return results.filter((s) => s.length >= MIN_CHUNK_CHARS);
}
