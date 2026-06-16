// Server-only Supabase helpers — do NOT import this in client components.
// For browser (client component) use, import from lib/supabase-browser.ts instead.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { PostgrestError } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
// lib/supabase/client.ts



export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-only service role client — bypasses RLS, never import in client components
export function createServiceClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// Server Component client — read-only cookies (fine for RSC data fetching)
export function createServerComponentClient(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // RSCs can't mutate cookies; mutations happen in middleware
      },
    },
  });
}

// Quality rule #4 — every Supabase query checks error and throws
export function throwIfError<T>(res: {
  data: T | null;
  error: PostgrestError | null;
}): T {
  if (res.error) {
    throw new Error(`Supabase error: ${res.error.message} (${res.error.code})`);
  }
  if (res.data === null) {
    throw new Error('Supabase query returned null data');
  }
  return res.data;
}

// Variant that allows null (for queries that may return no rows)
export function throwIfSupabaseError<T>(res: {
  data: T | null;
  error: PostgrestError | null;
}): T | null {
  if (res.error) {
    throw new Error(`Supabase error: ${res.error.message} (${res.error.code})`);
  }
  return res.data;
}
