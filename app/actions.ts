'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logAuthEvent } from '@/lib/logAuthEvent';
import {
  createShare, deleteReview, getCigaretteBySlug, revokeShare,
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
