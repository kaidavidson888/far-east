import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refreshes the Supabase session on every request and writes the rotated cookies
 * onto the response. Without this, server components see an expired session and
 * users are silently signed out.
 *
 * Everything here is best-effort. Middleware runs in front of *every* route, so
 * a failure must never take the site down — a crash here surfaces as
 * MIDDLEWARE_INVOCATION_FAILED and 500s every page, including ones that need no
 * session at all. Any error is swallowed and the request continues as signed out.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  try {
    let refreshed = response;

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          refreshed = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            refreshed.cookies.set(name, value, options);
          }
        },
      },
    });

    // Must be getUser(), not getSession(): only getUser() revalidates the token
    // with Supabase, and the cookie is attacker-controllable.
    await supabase.auth.getUser();

    return refreshed;
  } catch (error) {
    // Visible in the Vercel function logs without breaking the request.
    console.error('[middleware] session refresh failed:', error);
    return response;
  }
}
