'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { EMAIL_RE, MIN_PASSWORD } from '@/lib/authPolicy';
import { currentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { safeNext, signInGate, siteOrigin } from '@/lib/siteUrl';
import { pageFor } from '@/lib/cigPages';
import { CIG_PACKS } from '@/lib/cigRow';
import {
  accountState, createShare, deleteReview, getCigaretteBySlug, revokeShare, savePack,
  savedPackIds, setFavoriteNote, toggleFavorite, upsertReview,
} from '@/lib/db';

export type FormState = { error?: string; ok?: string } | null;

/* ---------- Account ---------- */
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const name = String(formData.get('display_name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const adult = formData.get('adult');

  if (!name || name.length < 2) return { error: 'Enter a display name of at least two characters.' };
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  if (password.length < 8) return { error: 'Passwords must be at least eight characters.' };
  if (password !== confirm) return { error: 'The two passwords do not match.' };
  if (!adult) return { error: 'You must confirm you are of legal smoking age.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Read by the handle_new_user trigger to populate profiles.display_name.
    options: { data: { display_name: name } },
  });

  if (error) return { error: error.message };

  logAuthEvent(email, 'signup');

  // With email confirmation enabled there is no session yet.
  if (!data.session) {
    return { ok: `Almost there — confirm your address from the email we just sent to ${email}.` };
  }

  redirect('/favorites');
}

/**
 * Sign in with Google.
 *
 * A SERVER ACTION AND NOT A LINK, which is the whole subtlety here. The flow
 * is PKCE: before the reader leaves for Google, a code verifier has to be
 * generated and stored in a cookie, and the code that comes back is worth
 * nothing without it. `signInWithOAuth` does the storing, through the server
 * client's cookie writer — and cookies can only be written from an action or a
 * route handler, never from a server component. An `<a href>` straight to
 * Google would skip all of that and the callback would have nothing to
 * exchange.
 *
 * So it returns a url rather than redirecting itself; this hands the reader to
 * it, and `app/auth/callback/route.ts` catches them coming back.
 *
 * Nothing is configured in this repo. The client id and secret live in the
 * Supabase dashboard (Authentication → Providers → Google) and never touch the
 * app or its environment.
 */
export async function signInWithGoogleAction(formData: FormData) {
  const next = safeNext(formData.get('next'));
  const origin = await siteOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  // The commonest cause by far is the provider being switched off in the
  // dashboard, which reads as validation_failed rather than anything about
  // Google. The login page says as much in plain words.
  if (error || !data.url) redirect('/login?error=provider');

  redirect(data.url);
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/favorites');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'That email and password do not match an account.' };

  logAuthEvent(email, 'login');

  redirect(next.startsWith('/') ? next : '/favorites');
}

export type SplashAuthState =
  | { error?: string; ok?: string; badEmail?: true; badPassword?: true }
  | null;

/**
 * The splash IS the sign-in screen. Email and password, with Google used once.
 *
 * WHAT THE BOX DOES, in the order it decides:
 *
 *   1. The address has to look like an address, and the password has to be
 *      long enough. Either failing flashes that row red and empties it.
 *   2. Try to sign in with the pair. If it works AND the account has been
 *      through Google, they are in and go where they were headed. **Google is
 *      not shown again — this is the path nearly every sign-in takes.**
 *   3. Sign-in failed and the address already has an account: the password is
 *      wrong. Flash the PASSWORD row and empty it, leaving the address alone,
 *      because the address is the half that was right.
 *   4. Sign-in failed and the address has no account: make one with this
 *      password, then hand them to Google to verify it. That is the one time
 *      Google is involved.
 *
 * An account that has a password but never finished at Google is not finished:
 * step 2 sends it back to Google rather than letting it in, so closing the tab
 * on Google's screen cannot be used to skip verification.
 *
 * THE PASSWORD GOES TO SUPABASE AUTH AND NOWHERE ELSE. It is bcrypt in
 * auth.users.encrypted_password, which is what signUp does with it. It is not
 * written to profiles, not put in a cookie, not carried through the Google
 * round trip, and never logged — logAuthEvent takes the address and the event
 * and nothing else.
 *
 * REQUIRES THE EMAIL PROVIDER. Both signInWithPassword and signUp answer
 * email_provider_disabled while it is switched off in Authentication →
 * Providers, so the box cannot work at all until it is on. That case is
 * reported in words rather than as a flash, because it is not the reader's
 * fault and no amount of retyping will fix it.
 */
export async function splashAuthAction(
  _prev: SplashAuthState,
  formData: FormData,
): Promise<SplashAuthState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const back = safeNext(formData.get('next'), '/landing');

  // Checked again here even though the overlay checks it: a server action is a
  // public endpoint.
  if (!EMAIL_RE.test(email)) return { badEmail: true };
  if (password.length < MIN_PASSWORD) {
    return { badPassword: true, error: `Passwords need at least ${MIN_PASSWORD} characters.` };
  }

  const supabase = await createClient();

  // ---- 1. the ordinary case: they have been here before --------------------
  const signIn = await supabase.auth.signInWithPassword({ email, password });

  if (offline(signIn.error)) return { error: PROVIDER_OFF };

  if (!signIn.error) {
    // Signed in — but an account that never finished at Google is not finished.
    const { googleLinked } = await accountState(email);
    if (googleLinked) {
      logAuthEvent(email, 'login');
      redirect(back);
    }
    return handToGoogle(email, back);
  }

  // ---- 2. it did not work: whose fault is it? -----------------------------
  const { exists } = await accountState(email);
  if (exists) return { badPassword: true };

  // ---- 3. nobody has this address: make the account, then verify it -------
  const signUp = await supabase.auth.signUp({ email, password });
  if (offline(signUp.error)) return { error: PROVIDER_OFF };
  if (mailerSpent(signUp.error)) return { error: MAILER_SPENT };
  if (signUp.error) return { error: signUp.error.message };

  // If confirmation is on there is no session; if it is off there is one, and
  // it is dropped on purpose. Either way the only way in is through Google,
  // which is what "verify your account" has to mean to be worth anything.
  if (signUp.data.session) await supabase.auth.signOut();

  logAuthEvent(email, 'signup');
  return handToGoogle(email, back);
}

/** What Supabase says when the email provider is switched off. */
const PROVIDER_OFF =
  'Signing in is not available at the moment. Please try again shortly.';

const offline = (e: { code?: string; message?: string } | null): boolean =>
  e?.code === 'email_provider_disabled' || /provider is disabled|logins are disabled/i.test(e?.message ?? '');

/**
 * The built-in mailer has run out, so NOBODY CAN MAKE AN ACCOUNT.
 *
 * This only happens because "Confirm email" is on. The confirmation mail it
 * insists on sending is dead weight to this design — Google is what verifies a
 * new account here, not an emailed link — and with no custom SMTP it goes
 * through Supabase's shared mailer, which is capped at a couple an hour. Past
 * the cap `signUp` does not queue or degrade: it fails and creates NOTHING, so
 * the reader is simply turned away.
 *
 * Turning "Confirm email" off (Authentication → Providers → Email) sends no
 * mail at all and lifts the cap. Nothing downstream changes: the session that
 * then comes back from `signUp` is dropped a few lines above, on purpose, and
 * Google is still the only way in.
 *
 * Worth saying plainly rather than passing Supabase's own words through: "email
 * rate limit exceeded" reads as the reader's fault, and it is not.
 */
const mailerSpent = (e: { code?: string; message?: string } | null): boolean =>
  e?.code === 'over_email_send_rate_limit' || /email rate limit/i.test(e?.message ?? '');

const MAILER_SPENT =
  'We could not finish setting up your account just now. Please try again in a little while.';

/**
 * Hand the reader to Google, carrying the address they typed.
 *
 * `login_hint` puts it into Google's own form so they land on their own
 * account; `expect` rides on our callback so the account that comes back can be
 * checked against the one that went out — picking a different Google account
 * at the prompt would otherwise quietly sign them into someone else's address.
 *
 * Returns a state rather than redirecting when it cannot start, so the box can
 * say so; the redirect itself throws, as redirects do, and is the last thing.
 */
async function handToGoogle(email: string, back: string): Promise<SplashAuthState> {
  const origin = await siteOrigin();
  const supabase = await createClient();

  const params = new URLSearchParams({ next: back, expect: email });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?${params}`,
      queryParams: { login_hint: email, prompt: 'select_account' },
    },
  });

  if (error || !data.url) {
    return { error: 'Google sign-in is not available at the moment. Please try again shortly.' };
  }
  redirect(data.url);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

/* ---------- Sharing ---------- */
/** Freezes the shelf as it stands and hands back a link anyone can open. */
export async function generateShareAction(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await createShare(user.id, randomBytes(12).toString('base64url'));
  revalidatePath('/favorites');
  revalidatePath('/account');
}

/** Cancels the live link. Every copy of it stops working immediately. */
export async function cancelShareAction(): Promise<void> {
  const user = await currentUser();
  if (!user) return;
  await revokeShare(user.id);
  revalidatePath('/favorites');
  revalidatePath('/account');
}

/* ---------- Favourites ---------- */
export async function toggleFavoriteAction(formData: FormData) {
  const user = await currentUser();
  const slug = String(formData.get('slug') ?? '');
  if (!user) redirect(signInGate(`/cigarette/${slug}`));

  const cig = await getCigaretteBySlug(slug);
  if (!cig) return;
  await toggleFavorite(user.id, cig.id);
  revalidatePath(`/cigarette/${slug}`);
  revalidatePath('/favorites');
  revalidatePath('/catalog');
  revalidatePath('/');
}

/**
 * The bookmark on a cigarette's own page.
 *
 * ADD-ONLY, not a toggle: the owner asked for the mark to go red permanently
 * once it is pressed, so a second press is not an undo. `savePack` is
 * idempotent, so a double submit cannot make a second row either.
 *
 * What is saved is the PAGE's id, which is not always the id in the address:
 * twelve packs share a name with another and open that one's page, and the
 * two are the same cigarette, so they save as one. `pageFor` resolves it,
 * and a pack that resolves to nothing is not saved rather than guessed at.
 *
 * This is a different shelf from /favorites, which keys on a catalogue row —
 * see supabase/migrations/0003_pack_favorites.sql.
 */
export async function savePackAction(formData: FormData) {
  const id = String(formData.get('pack') ?? '');
  const page = pageFor(id);
  if (!page) return;

  const user = await currentUser();
  if (!user) redirect(signInGate(`/packs/${id}`));

  await savePack(user.id, page.id);
  revalidatePath(`/packs/${id}`);
}

/**
 * The packs on the reader's shelf, for the My Saved spin on the landing page.
 *
 * Returns ids rather than rendering anything: the row is already on the page
 * and the spin swaps what it is showing, so all the client needs is the list.
 * The order is `savedPackIds`' own — most recently saved first.
 *
 * Signed out goes to the splash, the same gate the bookmark uses. It is a
 * redirect rather than an empty list because an empty list is a real answer
 * here (a shelf with nothing on it) and the two must not look alike.
 *
 * Ids are filtered against the packs the row can actually draw. A shelf holds
 * PAGE ids, and every one of the 235 pages is also a pack on the row, so today
 * this drops nothing — but a page that ever stops having a pack would
 * otherwise spin the row down to a gap.
 */
export async function savedPacksAction(): Promise<{ ids: string[] }> {
  const user = await currentUser();
  if (!user) redirect(signInGate('/landing'));
  const ids = await savedPackIds(user.id);
  const onRow = new Set(CIG_PACKS.map((p) => p.id));
  return { ids: ids.filter((id) => onRow.has(id)) };
}

export async function saveNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) return { error: 'You need to be signed in.' };
  const cigaretteId = Number(formData.get('cigarette_id'));
  await setFavoriteNote(user.id, cigaretteId, String(formData.get('note') ?? '').slice(0, 400));
  revalidatePath('/favorites');
  return { ok: 'Note saved.' };
}

/* ---------- Reviews ---------- */
export async function saveReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await currentUser();
  const slug = String(formData.get('slug') ?? '');
  if (!user) return { error: 'You need to be signed in to rate or review.' };

  const cig = await getCigaretteBySlug(slug);
  if (!cig) return { error: 'That product is no longer in the catalogue.' };

  const rating = Number(formData.get('rating'));
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    return { error: 'Choose a rating from 1 to 10.' };
  }
  const title = String(formData.get('title') ?? '').trim().slice(0, 120);
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);

  await upsertReview(user.id, cig.id, rating, title, body);
  revalidatePath(`/cigarette/${slug}`);
  revalidatePath('/catalog');
  return { ok: 'Your review is live.' };
}

export async function deleteReviewAction(formData: FormData) {
  const user = await currentUser();
  if (!user) return;
  const slug = String(formData.get('slug') ?? '');
  const cig = await getCigaretteBySlug(slug);
  if (!cig) return;
  await deleteReview(user.id, cig.id);
  revalidatePath(`/cigarette/${slug}`);
  revalidatePath('/catalog');
}
