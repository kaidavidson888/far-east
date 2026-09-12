import 'server-only';
import { headers } from 'next/headers';

/**
 * The origin this request arrived on, for building absolute URLs.
 *
 * OAuth needs one: the provider has to be told where to send the reader back,
 * and "back" cannot be a path. It has to be the origin the reader is actually
 * on, not a constant, or a sign-in started on localhost would finish on the
 * deployed site and vice versa.
 *
 * Vercel terminates TLS at the edge and talks to the function over http, so
 * the scheme has to come from x-forwarded-proto; taking it from the protocol
 * of the incoming request would build an http:// callback for an https:// site
 * and Google would reject it. Locally neither header is set and it falls back
 * to http://localhost:3000.
 *
 * NEXT_PUBLIC_SITE_URL overrides everything, for the case where the site sits
 * behind something that rewrites Host — nothing does today, so it is unset.
 */
export async function siteOrigin(): Promise<string> {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL;
  if (fixed) return fixed.replace(/\/+$/, '');

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return 'http://localhost:3000';

  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Where a signed-out reader is sent when they reach for something that needs
 * an account.
 *
 * THE SPLASH IS THE SIGN-IN SCREEN. `/` is the landing artwork with the splash
 * over it, and the splash's box IS the login form — so the gate is the front
 * door rather than a separate page. `/login` still exists and still works; it
 * is just not where somebody gets sent for pressing a bookmark.
 *
 * `next` rides along so the reader is put back where they were rather than on
 * the landing page, and comes back through `safeNext` at both ends.
 */
export function signInGate(next: string): string {
  return `/?next=${encodeURIComponent(next)}`;
}

/**
 * A redirect target that cannot leave this site.
 *
 * `next` rides through the OAuth handshake in a query string, which means it
 * comes back from outside and is not to be trusted. A bare `/path` is fine; a
 * protocol-relative `//evil.example` is NOT — browsers read it as an absolute
 * URL and it is the classic open redirect, which here would hand someone's
 * freshly minted session to another origin. Anything else falls back.
 */
export function safeNext(value: unknown, fallback = '/favorites'): string {
  const s = typeof value === 'string' ? value : '';
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return fallback;
  return s;
}
