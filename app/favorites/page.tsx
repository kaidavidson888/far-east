import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, shelfName } from '@/lib/auth';
import { activeShare, favoritesWithNotes, reviewsByUser, shareItems } from '@/lib/db';
import { formatMoment } from '@/lib/format';
import { ProductCard } from '@/components/ProductCard';
import { ScoreSeal } from '@/components/ScoreSeal';
import { SealDivider } from '@/components/SealDivider';
import { ShelfNote } from '@/components/ShelfNote';
import { ShelfSharing } from '@/components/ShelfSharing';
import { SurfacePreference } from '@/components/SurfacePreference';

export const metadata: Metadata = { title: 'My shelf' };

export default async function FavoritesPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/favorites');

  const items = await favoritesWithNotes(user.id);
  const myReviews = await reviewsByUser(user.id);
  const live = await activeShare(user.id);
  const share = live
    ? {
        path: `/list/${live.token}`,
        generatedAt: formatMoment(live.created_at),
        itemCount: (await shareItems(live.id)).length,
      }
    : null;

  return (
    <>
      <SurfacePreference mode="dark" />
      <div className="container band-sm stack-xl">
        <header className="stack-md">
          <span className="label muted">Your account</span>
          <h1 className="display-lg">{shelfName(user.display_name)}</h1>
          <p className="body-lg measure">
            {items.length
              ? `${items.length} ${items.length === 1 ? 'cigarette' : 'cigarettes'} saved${share ? ' · a share link is live' : ''}.`
              : 'Nothing saved yet. Anything you add from the catalogue lands here.'}
          </p>
          <SealDivider short />
        </header>

        <ShelfSharing
          shelfName={shelfName(user.display_name)}
          share={share}
          itemCount={items.length}
          variant="bar"
        />

        <div className="review-layout">
          <div className="stack-lg">
            {items.length ? (
              <div className="grid-cards">
                {items.map(({ cigarette: c, note }) => (
                  <ProductCard
                    key={c.id}
                    cigarette={c}
                    isFavorite
                    footer={<ShelfNote cigaretteId={c.id} note={note} />}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state stack-sm">
                <p className="title-lg">Your shelf is empty.</p>
                <p className="body-md">
                  Open anything in the catalogue and use &ldquo;Add to my shelf&rdquo;. You can annotate
                  each one and share the whole list with a link.
                </p>
                <Link href="/catalog" className="btn btn-primary" style={{ marginTop: 'var(--sm)' }}>
                  Browse the catalogue
                </Link>
              </div>
            )}
          </div>

          <aside className="stack-lg">
            <div className="card card-pad stack-sm">
              <h2 className="title-lg">Your reviews</h2>
              {myReviews.length ? (
                <ul className="stack-sm">
                  {myReviews.map((r) => (
                    <li key={r.id} className="row" style={{ gap: 'var(--sm)' }}>
                      <ScoreSeal score={r.rating} size="xs" label="Your score" />
                      <Link href={`/cigarette/${r.slug}`} className="ui grow ink">{r.cig_name}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="body-sm">You have not published a review yet.</p>
              )}
            </div>

            <Link href="/account" className="text-link">Account settings →</Link>
          </aside>
        </div>
      </div>
    </>
  );
}
