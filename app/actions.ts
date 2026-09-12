'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { safeNext, signInGate, siteOrigin } from '@/lib/siteUrl';
import { pageFor } from '@/lib/cigPages';
import {
  createShare, deleteReview, getCigaretteBySlug, revokeShare, savePack,
  setFavoriteNote, toggleFavorite, upsertReview,
} from '@/lib/db';

export type FormState = { error?: string; ok?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  | { error?: string; ok?: string; badEmail?: true }
  | null;

/**
 * The splash IS the sign-in screen, and Google does the authenticating.
 *
 * The reader types their email into the top row of the box and presses create
 * account / log in. That address is handed to Google as a `login_hint`, so they
 * arrive at their own account rather than at an account picker, and Google
 * decides whether this is a new account or one they already have — we never
 * find out, and we do not need to. **No password is asked for here and none is
 * stored anywhere.** The identity, and the name and picture on it, are Google's;
 * all this site keeps is the profiles row the signup trigger writes from what
 * Google sends (migration 0004).
 *
 * The box's PASSWORD row is still drawn, because it is baked into the frames
 * and is part of the picture the owner made. It is not typed into.
 *
 * Same PKCE flow as the button on /login — see signInWithGoogleAction for why
 * this has to be an action rather than a link — and the same callback catches
 * them coming back.
 *
 * `next` is where they were when they were stopped, so pressing the bookmark on
 * a cigarette's page puts them back on that page rather than on the landing
 * page. It came from a query string, so it is checked again here: a server
 * action is a public endpoint.
 */
export async function splashAuthAction(
  _prev: SplashAuthState,
  formData: FormData,
): Promise<SplashAuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const back = safeNext(formData.get('next'), '/');

  // The form flashes the row red and clears it on a rejection. Checked here as
  // well as in the overlay, which is where the flash is decided.
  if (!EMAIL_RE.test(email)) return { badEmail: true };

  const origin = await siteOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(back)}`,
      // Google's own parameters, passed straight through. login_hint puts the
      // address they typed into Google's form; select_account means somebody
      // signed into two Google accounts still gets to choose, rather than being
      // silently taken into whichever one the browser happens to hold.
      queryParams: { login_hint: email, prompt: 'select_account' },
    },
  });

  // Nearly always the provider being switched off in the Supabase dashboard,
  // which reads as validation_failed rather than as anything about Google.
  if (error || !data.url) {
    return { error: 'Google sign-in is not available at the moment. Please try again shortly.' };
  }

  // NOT logged here: the reader has not signed in yet, only been handed to
  // Google. app/auth/callback/route.ts logs them when they come back, and it
  // can tell a new account from a returning one.
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
