import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { safeNext, siteOrigin } from '@/lib/siteUrl';

/**
 * Where Google sends the reader back.
 *
 * WHY THIS ROUTE HAS TO EXIST. @supabase/ssr signs in over PKCE: the outbound
 * leg stores a code verifier in a cookie and the provider returns a one-time
 * `code`, which is worth nothing without that verifier. Exchanging the two for
 * a session is a server job, and it has to happen somewhere that can WRITE
 * cookies — which a server component cannot. A route handler can, so this is
 * it. Nothing here is Google-specific; any provider added later comes back
 * through the same door.
 *
 * Google itself never sees this address. The redirect URI registered in the
 * Google console is Supabase's own /auth/v1/callback; Supabase does the
 * handshake and then forwards to whatever `redirectTo` asked for, which is
 * this — and only if it matches the Redirect URLs allow-list in Authentication
 * → URL Configuration. Both localhost and the deployed origin have to be on
 * that list or the last hop lands nowhere.
 *
 * Runs on the Node runtime, like everything else here. The one piece of this
 * app that ever ran on the edge was the session middleware, and it crashed
 * (MIDDLEWARE_INVOCATION_FAILED) — see HANDOFF.md.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = await siteOrigin();
  const next = safeNext(url.searchParams.get('next'));

  // The reader pressed "cancel" on Google's own screen, or the provider is
  // misconfigured. Either way there is no code to exchange.
  const denied = url.searchParams.get('error');
  if (denied) {
    const why = denied === 'access_denied' ? 'cancelled' : 'provider';
    return NextResponse.redirect(`${origin}/login?error=${why}`);
  }

  const code = url.searchParams.get('code');
  if (!code) return NextResponse.redirect(`${origin}/login?error=provider`);

  // Who the splash expected to come back. It is only set when the round trip
  // started from the box, where the reader typed an address and had an account
  // made for it — see splashAuthAction.
  const expect = (url.searchParams.get('expect') ?? '').trim().toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  // A stale or replayed code, or a verifier cookie that is gone — the reader
  // cleared their cookies mid-handshake, or came back to an old tab.
  if (error || !data.session) return NextResponse.redirect(`${origin}/login?error=expired`);

  // THE ACCOUNT THAT CAME BACK HAS TO BE THE ONE THAT WENT OUT. Google shows
  // an account chooser, so somebody who typed one address and then picked a
  // different Google account would otherwise be signed into that one instead —
  // leaving the address they typed behind as an account with a password and
  // nobody attached, and signing them into an identity they did not ask for.
  // The session is dropped and they are sent back to try again.
  if (expect && (data.user.email ?? '').toLowerCase() !== expect) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=mismatch`);
  }

  // Which event this was, for the owner's log. A brand-new account has its
  // first sign-in stamped at the same moment it is created, so the two
  // timestamps are within a heartbeat of each other; a returning reader's are
  // minutes or months apart. A heuristic, and deliberately one that can only
  // ever mislabel a line in a spreadsheet — it is not in the auth path.
  const { user } = data;
  const created = Date.parse(user.created_at ?? '');
  const signedIn = Date.parse(user.last_sign_in_at ?? '');
  const fresh = Number.isFinite(created) && Number.isFinite(signedIn)
    && Math.abs(signedIn - created) < 5000;
  // email, timestamp and which event. Never anything secret — no tokens, no
  // provider payload, no password. See lib/logAuthEvent.ts.
  if (user.email) logAuthEvent(user.email, fresh ? 'signup' : 'login');

  return NextResponse.redirect(`${origin}${next}`);
}
