import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { savedPacks } from '@/lib/db';
import { CIG_PACKS } from '@/lib/cigRow';
import { signInGate } from '@/lib/siteUrl';
import { ShelfPage } from '@/components/ShelfPage';
import type { ShelfEntry } from '@/lib/shelfPage';

export const metadata: Metadata = {
  // the root layout appends " · Far East"
  title: 'Shelf',
};

/**
 * The reader's pack shelf, as the owner's design draws it: every cigarette
 * they have saved, most recent first, with how many of it they have if the
 * plus button on its page was used.
 *
 * This is where the seal goes. Press it, let it finish, press it again.
 *
 * A signed-out reader is sent to the splash, the same gate the bookmark and
 * My Saved use, and comes back here afterwards.
 */
export default async function ShelfRoute() {
  const user = await currentUser();
  if (!user) redirect(signInGate('/shelf'));

  const shelf = await savedPacks(user.id);
  const byId = new Map(CIG_PACKS.map((p) => [p.id, p] as const));
  // a shelf holds PAGE ids, every one of which is also a pack on the row —
  // but a pack that ever left the row should drop off the shelf, not break it
  const entries: ShelfEntry[] = shelf.flatMap((s) => {
    const pack = byId.get(s.packId);
    return pack ? [{ pack, amount: s.amount, unit: s.unit }] : [];
  });

  return <ShelfPage entries={entries} />;
}
