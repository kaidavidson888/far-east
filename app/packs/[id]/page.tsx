import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { packIsSaved } from '@/lib/db';
import { pageFor } from '@/lib/cigPages';
import { CigPage } from '@/components/CigPage';

/**
 * A cigarette's own page, one per pack, built from the supplied vectors.
 *
 * `id` is the pack's source filename — `101_Changbaishan-Soft_Red` — which
 * is what the landing page's buttons carry and what the owner asked the
 * marks to be named by, so the two line up without a lookup table.
 *
 * Not every pack has a vector of its own: the owner supplied one per
 * cigarette *name*, and twelve packs carry a name another pack already has.
 * Those open their twin's page — see lib/cigPages.ts — so every pack on the
 * landing row leads somewhere.
 *
 * Reading whether the bookmark is already pressed makes this route dynamic,
 * which it has to be: the answer is different for every reader. A signed-out
 * one asks the database nothing — there is nobody to have saved it — and the
 * bookmark renders black, which is also what it looks like to somebody who
 * has simply not pressed it yet.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = pageFor(decodeURIComponent(id));
  // the root layout appends " · Far East"
  return page ? { title: page.name } : {};
}

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const packId = decodeURIComponent(id);
  const page = pageFor(packId);
  if (!page) notFound();

  const user = await currentUser();
  const saved = user ? await packIsSaved(user.id, page.id) : false;

  return (
    <CigPage
      id={page.id}
      name={page.name}
      gap={page.gap}
      packId={packId}
      saved={saved}
    />
  );
}
