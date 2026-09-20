import 'server-only';
import { accountFinished, profileById } from './db';
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

  /*
   * A HALF-MADE ACCOUNT IS NOT SIGNED IN. The splash's phone flow signs a new
   * reader in on their SMS code, because the address and the password are
   * then written onto that account and there is no service-role key here to
   * do it another way — so between the code and the password a real session
   * exists for an account with no password on it, and navigating away would
   * leave the reader signed in for good. Asking here rather than signing them
   * out keeps the flow able to finish the account, and covers every page at
   * once because this is the one gate they all read.
   */
  if (!(await accountFinished(data.user.id))) return null;

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
