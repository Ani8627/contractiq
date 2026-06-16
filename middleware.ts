import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  // Build a Supabase server client that can refresh session cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          }
        },
      },
    },
  );

  // Refresh session (keeps auth tokens fresh)
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id ?? null;

  // /history requires authentication
  if (pathname === '/history' && !userId) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // /review/:id — ownership check for user-owned contracts
  const reviewMatch = pathname.match(/^\/review\/([a-f0-9-]{36})/i);
  if (reviewMatch) {
    const contractId = reviewMatch[1];

    // Service-role fetch to check ownership (edge-compatible plain fetch)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceKey) {
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/contracts?id=eq.${contractId}&select=user_id`,
          {
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (res.ok) {
          const rows = await res.json() as Array<{ user_id: string | null }>;
          const contractUserId = rows[0]?.user_id ?? null;
          // If contract belongs to a specific user and it's not the current user → 403
          if (contractUserId !== null && contractUserId !== userId) {
            return new NextResponse('Forbidden', { status: 403 });
          }
        }
      } catch {
        // On network error let the page handle it (defense-in-depth check in page.tsx)
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
