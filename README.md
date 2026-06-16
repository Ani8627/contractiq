# ContractIQ — AI Contract Negotiator

AI-powered contract analysis: upload a PDF → clause-by-clause risk assessment with market benchmarks, plain-English summaries, counter-proposals, and rewrite suggestions. RAG-grounded chat that scales to 100-page contracts.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Gemini 2.5 Flash** (free, via Google AI Studio) for analysis and chat
- **Gemini Embedding** (`gemini-embedding-001`, free) for RAG
- **Supabase** (Postgres + pgvector + Auth + Storage)
- **Upstash Redis** (optional, for rate limiting)

---

## Setup

### 1. Fill `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=      # From Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY= # From Supabase → Settings → API
SUPABASE_SERVICE_ROLE_KEY=     # From Supabase → Settings → API (secret)
GEMINI_API_KEY=                # From aistudio.google.com → Get API key (free)
GEMINI_MIN_INTERVAL_MS=6500    # Free-tier pacing (ms between requests). Set to 0 on paid key.
UPSTASH_REDIS_REST_URL=        # Optional — Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=      # Optional — Upstash Redis REST token
```

> **Note on free-tier speed:** Gemini's free AI Studio tier allows ~10 requests/minute. With 5 agent steps per clause, a 20-clause contract takes ~10 minutes to analyze. The UI streams live progress throughout. A paid API key + `GEMINI_MIN_INTERVAL_MS=0` makes it near-instant.

### 2. Apply database migrations in Supabase SQL editor

Run in order:

1. **`supabase/schema.sql`** — creates tables, pgvector extension, HNSW indexes, and RPC functions
2. **`supabase/rls.sql`** — Row Level Security policies
3. **`supabase/seed_library.sql`** — ~30 curated market-standard clause benchmarks (embeddings added in step 4)

### 3. Backfill benchmark embeddings (one-time)

```bash
npx tsx scripts/embed-library.ts
```

This embeds the ~30 library entries via Gemini. Takes ~3 minutes on the free tier. Re-run after adding new library entries.

### 4. Enable Google OAuth in Supabase

1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Add your Google Cloud OAuth client ID and secret
3. Add to Authorized redirect URIs in Google Cloud Console:
   - `http://localhost:3000/auth/callback` (dev)
   - `https://your-domain.com/auth/callback` (prod)

### 5. (Optional) Upstash Redis for rate limiting

Without it, rate limiting is disabled (with a warning). To enable:
1. Create a Redis database at upstash.com
2. Copy the REST URL and token into `.env.local`

**Free-tier limits:** 3 analyses/hour per IP (anonymous), 20/day per user (authenticated).

### 6. Run

```bash
npm run dev
```

Visit `http://localhost:3000`.

---

## Features

| Feature | Detail |
|---|---|
| **PDF upload** | Drag-and-drop, click to browse. PDFs only, max 10 MB. |
| **5-step analysis per clause** | Classify → Assess → Explain → Propose → Rewrite, streamed live via SSE |
| **RAG market benchmarks** | Each assess/propose step retrieves matching market-standard clauses from the benchmark library and grounds the output |
| **"vs. Market Standard" callout** | Every clause card shows a benchmark comparison (e.g., "Market standard caps liability at 12 months' fees; this clause is uncapped") |
| **Plain English summaries** | 3–4 sentences, no jargon |
| **Counter-proposals** | Specific redline suggestions referencing benchmark language |
| **Rewritten clauses** | Full ready-to-paste rewrites with word-level diff |
| **Risk scoring** | Weighted 1–4 score with gauge, breakdown by clause type, top-3 most concerning |
| **RAG chat** | Chat retrieves the top-6 semantically relevant clauses per question — scales to 100-page contracts |
| **Exports** | Markdown report with full analysis; PDF with red highlights on high/critical-risk pages |
| **Auth** | Google OAuth via Supabase. Anonymous: 1 free analysis (3/hr). Authenticated: 20/day. History page for signed-in users. |
| **Mobile** | Collapses to single-column with Clauses / Detail / Diff tabs |

---

## Architecture notes

- **Free-tier pacing:** `lib/gemini.ts` implements a serial queue with `GEMINI_MIN_INTERVAL_MS` spacing between API calls, plus exponential backoff on 429 errors. The SSE heartbeat keeps the stream alive through waits.
- **Fail-safe embeddings:** Clause embeddings happen async at upload (fire-and-forget). If embedding fails, chat falls back to first-6-clauses mode — analysis always works.
- **Defense in depth:** Ownership check runs in both middleware and the review page server component.
- **No inline styles:** All dynamic colors use discrete Tailwind cells (20-segment progress bars) except the typing indicator dots (unavoidable animation delay via `style`).
