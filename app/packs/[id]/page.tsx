import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import geometry from '@/lib/cigpages.json';
import { CigPage } from '@/components/CigPage';

/**
 * A cigarette's own page, one per pack, built from the supplied vectors.
 *
 * `id` is the pack's source filename — `101_Changbaishan-Soft_Red` — which
 * is what the landing page's buttons carry and what the owner asked the
 * marks to be named by, so the two line up without a lookup table.
 *
 * Not every pack has a page: the owner supplied 227 info-page vectors for
 * 247 packs. A pack without one is left unpressable on the landing page
 * rather than linking here to a 404.
 */
const pages = new Map(geometry.pages.map((p) => [p.id, p]));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const page = pages.get(decodeURIComponent(id));
  // the root layout appends " · Far East"
  return page ? { title: page.name } : {};
}

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = pages.get(decodeURIComponent(id));
  if (!page) notFound();
  return <CigPage id={page.id} name={page.name} />;
}
