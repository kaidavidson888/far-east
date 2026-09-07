import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { facetCounts, favoriteIds, listCigarettes, type CatalogQuery } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { FACET_LABELS, FACET_ORDER } from '@/lib/seed';
import { CatalogFilters, type FacetGroup } from '@/components/CatalogFilters';
import { ProductCard } from '@/components/ProductCard';
import { SealDivider } from '@/components/SealDivider';
import { SurfacePreference } from '@/components/SurfacePreference';

export const metadata: Metadata = {
  title: 'Catalogue',
  description: 'Every cigarette in the Far East catalogue, filterable by country, brand, strength, flavour, format, filter and tar.',
};

type SP = Record<string, string | string[] | undefined>;

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function buildGroups(counts: Record<string, Record<string, number>>): FacetGroup[] {
  const ordered = (key: keyof typeof FACET_ORDER): FacetGroup => ({
    key,
    label: FACET_LABELS[key],
    values: FACET_ORDER[key]
      .filter((v) => counts[key]?.[v])
      .map((v) => ({ value: v, count: counts[key][v] })),
  });

  const alpha = (key: 'country' | 'brand'): FacetGroup => ({
    key,
    label: FACET_LABELS[key],
    values: Object.entries(counts[key] ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, count })),
  });

  return [alpha('country'), ordered('strength'), ordered('flavour'), ordered('format'), ordered('filterType'), alpha('brand')];
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await currentUser();

  const query: CatalogQuery = {
    q: typeof sp.q === 'string' ? sp.q : undefined,
    country: asArray(sp.country),
    brand: asArray(sp.brand),
    strength: asArray(sp.strength),
    flavour: asArray(sp.flavour),
    format: asArray(sp.format),
    filterType: asArray(sp.filterType),
    maxTar: sp.maxTar ? Number(sp.maxTar) : undefined,
    sort: typeof sp.sort === 'string' ? sp.sort : 'rating',
  };

  const results = await listCigarettes(query);
  const groups = buildGroups(await facetCounts());
  const favorites = new Set(user ? await favoriteIds(user.id) : []);

  return (
    <>
      <SurfacePreference mode="dark" />
      <div className="container band-sm stack-xl">
        <header className="stack-md">
          <span className="label muted">Catalogue</span>
          <h1 className="display-lg">Every cigarette in the catalogue.</h1>
          <p className="body-lg measure">
            Filter by where it is made, how strong it is, what shape it comes in and how much tar
            the label declares. Scores come from readers. Everything here is readable without an
            account.
          </p>
          <SealDivider short />
        </header>

        <Suspense fallback={<p className="ui muted">Loading filters…</p>}>
          <CatalogFilters groups={groups} resultCount={results.length} />
        </Suspense>

        {results.length ? (
          <div className="grid-cards">
            {results.map((c) => (
              <ProductCard key={c.id} cigarette={c} isFavorite={favorites.has(c.id)} />
            ))}
          </div>
        ) : (
          <div className="empty-state stack-sm">
            <p className="title-lg">Nothing matches that combination.</p>
            <p className="body-md">
              Loosening one filter usually does it — country and format together are the pair that
              most often leaves you with nothing.
            </p>
            <Link href="/catalog" className="text-link">Clear all filters →</Link>
          </div>
        )}
      </div>
    </>
  );
}
