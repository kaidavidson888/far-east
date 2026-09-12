'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuthEvent } from '@/lib/logAuthEvent';
import { normalisePhone } from '@/lib/phone';
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
  | { error?: string; ok?: string; badPhone?: true; badPassword?: true }
  | null;

/**
 * The splash's one button is "create account / login". There is a single field
 * pair — no confirmation, no display name, no age gate — so a number that
 * already has an account signs into it and anything else gets an account made
 * for it, and either way the reader lands on the homepage.
 *
 * This row is a PHONE number, not an email. Two consequences worth knowing:
 *
 *  - Supabase will not do phone auth at all until an SMS provider is set up
 *    (Authentication → Providers → Phone). Until then sign-up comes back with
 *    a provider error, which surfaces in the form's error line.
 *  - profiles.display_name is NOT NULL and the on_auth_user_created trigger
 *    falls back to split_part(new.email, '@', 1) — NULL for a phone sign-up,
 *    which would fail the insert and take the sign-up down with it. Passing
 *    display_name in the sign-up metadata takes the trigger's first branch
 *    instead, so no migration is needed.
 */
export async function splashAuthAction(
  _prev: SplashAuthState,
  formData: FormData,
): Promise<SplashAuthState> {
  // normalisePhone is the validator and the normaliser both: E.164 out, or
  // null. The form flashes the box red and clears the row on null, and it is
  // re-checked here because a server action is a public endpoint.
  const phone = normalisePhone(String(formData.get('phone') ?? ''));
  const password = String(formData.get('password') ?? '');

  if (!phone) return { badPhone: true };
  if (!password) return { error: 'Enter a password.' };

  const supabase = await createClient();

  // Sign in first, so a returning reader is never told their own number is
  // taken.
  const signIn = await supabase.auth.signInWithPassword({ phone, password });
  if (!signIn.error) {
    logAuthEvent(phone, 'login');
    redirect('/');
  }

  const { data, error } = await supabase.auth.signUp({
    phone,
    password,
    // Read by the handle_new_user trigger; without it display_name comes out
    // NULL for a phone sign-up and the NOT NULL insert fails.
    options: { data: { display_name: phone } },
  });

  // Sign-in has already failed, so a number that turns out to be taken means
  // the password was wrong — the form flashes the box and clears that row.
  // Supabase says so two different ways: with confirmation off it is an error,
  // and with it on the sign-up answers with a user carrying no identities
  // instead, so the endpoint cannot be used to enumerate accounts.
  const taken =
    error?.code === 'user_already_exists'
    || /already (registered|exists)/i.test(error?.message ?? '')
    || (!!data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
  if (taken) return { badPassword: true };
  if (error) return { error: error.message };

  logAuthEvent(phone, 'signup');

  // Phone confirmation on → no session yet, so there is nothing to redirect to.
  if (!data.session) {
    return { ok: `Almost there — confirm the code we just sent to ${phone}.` };
  }

  redirect('/');
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
  if (!user) redirect(`/login?next=${encodeURIComponent(`/cigarette/${slug}`)}`);

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
  if (!user) redirect(`/login?next=${encodeURIComponent(`/packs/${id}`)}`);

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
