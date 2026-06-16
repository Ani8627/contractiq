-- Row Level Security policies
-- Server API routes use the service-role key (bypasses RLS).
-- RLS protects against direct client-side access.

alter table contracts enable row level security;
alter table clauses enable row level security;
alter table analyses enable row level security;
alter table clause_library enable row level security;

-- Users can only read/write their own contracts
create policy "users own contracts"
  on contracts for all using (auth.uid() = user_id);

-- Users can read clauses that belong to their contracts
create policy "users own clauses"
  on clauses for all using (
    contract_id in (select id from contracts where user_id = auth.uid())
  );

-- Users can read analyses for their clauses
create policy "users own analyses"
  on analyses for all using (
    clause_id in (select id from clauses where contract_id in (
      select id from contracts where user_id = auth.uid()
    ))
  );

-- Benchmark library is public read (no personal data)
create policy "library is readable"
  on clause_library for select using (true);
-- library modifications are via service-role only (no insert/update policy needed)
