-- Enable pgvector extension for RAG (run this first)
create extension if not exists vector;

-- Contracts table: stores the parsed contract text and original PDF path
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  filename text not null,
  raw_text text not null,
  storage_path text,
  created_at timestamptz default now()
);

-- Clauses table: individual parsed clauses with embeddings for semantic search
create table clauses (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references contracts(id) on delete cascade,
  clause_number integer not null,
  original_text text not null,
  clause_type text,
  page_number integer,
  embedding vector(768)
);

-- Analyses table: agent-generated analysis per clause
create table analyses (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid references clauses(id) on delete cascade,
  risk_level text check (risk_level in ('low','medium','high','critical')),
  plain_english text,
  flags jsonb,
  counter_proposal text,
  rewritten_text text,
  market_comparison text
);

-- Clause library: curated market-standard clauses for RAG-grounded analysis
create table clause_library (
  id uuid primary key default gen_random_uuid(),
  clause_type text not null,
  title text not null,
  standard_text text not null,
  guidance text not null,
  severity_hint text check (severity_hint in ('low','medium','high','critical')),
  embedding vector(768)
);

-- Unique constraint: one analysis per clause
create unique index analyses_clause_id_key on analyses (clause_id);

-- HNSW indexes for fast cosine similarity search
create index clauses_embedding_idx on clauses using hnsw (embedding vector_cosine_ops);
create index clause_library_embedding_idx on clause_library using hnsw (embedding vector_cosine_ops);

-- Private bucket for storing original PDF files
insert into storage.buckets (id, name, public)
values ('contracts', 'contracts', false)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------
-- RPC: semantic search over contract clauses (used by RAG chat)
-- -----------------------------------------------------------------------
create or replace function match_clauses(
  query_embedding vector(768),
  p_contract_id uuid,
  match_count int default 6
) returns table (
  id uuid,
  clause_number int,
  clause_type text,
  original_text text,
  similarity float
) language sql stable as $$
  select
    c.id,
    c.clause_number,
    c.clause_type,
    c.original_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from clauses c
  where c.contract_id = p_contract_id
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- -----------------------------------------------------------------------
-- RPC: semantic search over benchmark library (used by assess/propose)
-- -----------------------------------------------------------------------
create or replace function match_library(
  query_embedding vector(768),
  p_clause_type text,
  match_count int default 2
) returns table (
  id uuid,
  title text,
  standard_text text,
  guidance text,
  severity_hint text,
  similarity float
) language sql stable as $$
  select
    l.id,
    l.title,
    l.standard_text,
    l.guidance,
    l.severity_hint,
    1 - (l.embedding <=> query_embedding) as similarity
  from clause_library l
  where (l.clause_type = p_clause_type or p_clause_type = 'other')
    and l.embedding is not null
  order by l.embedding <=> query_embedding
  limit match_count;
$$;
