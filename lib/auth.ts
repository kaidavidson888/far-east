import 'server-only';
import { profileById } from './db';
import { createClient } from './supabase/server';

export type User = { id: string; email: string; display_name: string };

/** A shelf is always named after the person who keeps it. */
export function shelfName(displayName: string): string {
  return /s$/i.test(displayName) ? `${displayName}' shelf` : `${displayName}'s shelf`;
}

/**
 * The signed-in user, or null. Uses getUser() rather than getSession() so the
 * token is revalidated with Supabase instead of trusted from the cookie.
 */
export async function currentUser(): Promise<User | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const profile = await profileById(data.user.id);
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    // The profile row is created by a trigger on signup; fall back defensively.
    display_name:
      profile?.display_name
      ?? (data.user.user_metadata?.display_name as string | undefined)
      ?? (data.user.email ?? 'Reader').split('@')[0],
  };
}
