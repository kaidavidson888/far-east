import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, shelfName } from '@/lib/auth';
import { activeShare, favoriteIds, reviewsByUser, shareItems } from '@/lib/db';
import { formatMoment } from '@/lib/format';
import { logoutAction } from '@/app/actions';
import { ScoreSeal } from '@/components/ScoreSeal';
import { SealDivider } from '@/components/SealDivider';
import { ShelfSharing } from '@/components/ShelfSharing';
import { SurfacePreference } from '@/components/SurfacePreference';

export const metadata: Metadata = { title: 'Account' };

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');

  const reviews = await reviewsByUser(user.id);
  const saved = (await favoriteIds(user.id)).length;
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
          <span className="label muted">Account</span>
          <h1 className="display-lg">{user.display_name}</h1>
          <p className="body-lg">{user.email}</p>
          <SealDivider short />
        </header>

        <div className="review-layout">
          <div className="stack-lg">
            <div className="spec-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="spec-cell"><p className="spec-value">{saved}</p><p className="label">On the shelf</p></div>
              <div className="spec-cell"><p className="spec-value">{reviews.length}</p><p className="label">Reviews written</p></div>
              <div className="spec-cell">
                <p className="spec-value">
                  {reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—'}
                </p>
                <p className="label">Your average score</p>
              </div>
            </div>

            <div className="card card-pad stack-md">
              <h2 className="title-lg">Your reviews</h2>
              {reviews.length ? (
                <ul className="stack-md">
                  {reviews.map((r) => (
                    <li key={r.id} className="row" style={{ alignItems: 'flex-start', gap: 'var(--md)' }}>
                      <ScoreSeal score={r.rating} size="xs" label="Your score" />
                      <div className="grow stack-xs">
                        <Link href={`/cigarette/${r.slug}`} className="title-sm">{r.cig_name}</Link>
                        {r.title ? <p className="body-sm ink">{r.title}</p> : null}
                        {r.body ? <p className="body-sm">{r.body.slice(0, 160)}{r.body.length > 160 ? '…' : ''}</p> : null}
                        <Link href={`/cigarette/${r.slug}#readers`} className="text-link">Edit →</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="body-md">
                  Nothing yet. <Link href="/catalog" className="inline-link">Pick something from the catalogue</Link> and
                  score it out of ten.
                </p>
              )}
            </div>

            <form action={logoutAction}>
              <button type="submit" className="btn btn-secondary">Sign out</button>
            </form>
          </div>

          <aside className="stack-lg">
            <ShelfSharing
              shelfName={shelfName(user.display_name)}
              share={share}
              itemCount={saved}
            />
            <Link href="/favorites" className="text-link">Go to my shelf →</Link>
          </aside>
        </div>
      </div>
    </>
  );
}
