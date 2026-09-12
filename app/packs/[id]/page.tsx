import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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
  const page = pageFor(decodeURIComponent(id));
  if (!page) notFound();
  return <CigPage id={page.id} name={page.name} />;
}
