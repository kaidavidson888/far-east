import Link from 'next/link';
import { favoriteIds, listCigarettes, recentReviews } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { ProductCard } from '@/components/ProductCard';
import { ScoreSeal } from '@/components/ScoreSeal';
import { SealDivider } from '@/components/SealDivider';
import { SplashScreen } from '@/components/SplashScreen';
import { SurfacePreference } from '@/components/SurfacePreference';

// TODO: swap in the real Instagram handle and URL.
const INSTAGRAM_URL = '#';
const INSTAGRAM_HANDLE = '@fareast';
import { formatDate } from '@/lib/format';

export default async function HomePage() {
  const user = await currentUser();
  const favorites = new Set(user ? await favoriteIds(user.id) : []);
  // Sorted by reader rating, so the lead is whatever readers rate highest.
  // Before anyone has rated anything there is no lead to show.
  const all = await listCigarettes({ sort: 'rating' });
  const lead = all.find((c) => c.userCount > 0) ?? null;
  const picks = all.filter((c) => c.id !== lead?.id).slice(0, 6);
  const reviews = await recentReviews(4);
  const countries = new Set(all.map((c) => c.country)).size;

  return (
    <>
      <SurfacePreference mode="dark" />
      <SplashScreen />

      {/* Hero */}
      <section className="container" style={{ paddingBlock: 'var(--xxl)' }}>
        <div className="stack-lg" style={{ maxWidth: 900 }}>
          <span className="label muted">遠東 · Independent since 2024</span>
          <h1 className="display-xl">Every cigarette worth knowing about, rated by the people who smoke them.</h1>
          <p className="body-lg measure">
            {all.length} products from {countries} markets. Every score on this site comes from
            readers — there is no house rating. Browsing is free and open: no paywall, no
            affiliate links{user ? '.' : ', and no account needed. Create one only if you want to rate, review and build a shelf.'}
          </p>
          <div className="row wrap" style={{ gap: 'var(--sm)' }}>
            <Link href="/catalog" className="btn btn-primary">Browse the catalogue</Link>
            {user ? null : (
              <Link href="/register" className="btn btn-secondary">Create an account</Link>
            )}
          </div>
        </div>
      </section>

      {/* Lead review */}
      {lead ? (
        <section className="container" style={{ paddingBottom: 'var(--section)' }}>
          <SealDivider />
          <div className="review-layout" style={{ marginTop: 'var(--xl)' }}>
            <div className="stack-lg">
              <span className="label" style={{ color: 'var(--cinnabar)' }}>Highest rated by readers</span>
              <h2 className="display-lg">{lead.name}</h2>
              <p className="body-lg">{lead.summary}</p>
              <div className="row wrap" style={{ gap: 'var(--sm)' }}>
                <Link href={`/cigarette/${lead.slug}`} className="btn btn-primary">See the reviews</Link>
                <Link href={`/catalog?brand=${encodeURIComponent(lead.brand)}`} className="btn btn-secondary">
                  More from {lead.brand}
                </Link>
              </div>
            </div>
            <div className="stack-md">
              <ScoreSeal score={lead.userAvg} />
              <p className="caption">
                from {lead.userCount} reader {lead.userCount === 1 ? 'rating' : 'ratings'}
              </p>
              <dl className="stack-xs">
                <div className="row-between"><dt className="caption">Country</dt><dd className="ui ink">{lead.country}</dd></div>
                <div className="row-between"><dt className="caption">Tar</dt><dd className="mono-sm ink">{lead.tar_mg} mg</dd></div>
                <div className="row-between"><dt className="caption">Nicotine</dt><dd className="mono-sm ink">{lead.nicotine_mg} mg</dd></div>
                <div className="row-between"><dt className="caption">Format</dt><dd className="ui ink">{lead.format}</dd></div>
              </dl>
            </div>
          </div>
        </section>
      ) : null}

      {/* Top picks */}
      <section className="container" style={{ paddingBottom: 'var(--section)' }}>
        <div className="row-between wrap" style={{ marginBottom: 'var(--xl)' }}>
          <h2 className="display-md">In the catalogue</h2>
          <Link href="/catalog" className="text-link">See all {all.length} →</Link>
        </div>
        <div className="grid-cards">
          {picks.map((c) => (
            <ProductCard key={c.id} cigarette={c} isFavorite={favorites.has(c.id)} />
          ))}
        </div>
      </section>

      {/* Reader reviews */}
      <section className="container" style={{ paddingBottom: 'var(--section)' }}>
        <div className="row-between wrap" style={{ marginBottom: 'var(--xl)' }}>
          <h2 className="display-md">From readers</h2>
          <Link href="/catalog?sort=rating" className="text-link">Catalogue by reader rating →</Link>
        </div>
        {reviews.length ? (
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {reviews.map((r) => (
              <article key={r.id} className="review-card stack-sm">
                <div className="row">
                  <ScoreSeal score={r.rating} size="xs" label={`${r.display_name}'s score`} />
                  <div className="grow">
                    <Link href={`/cigarette/${r.slug}`} className="title-md">{r.cig_name}</Link>
                    <p className="caption">{r.display_name} · {formatDate(r.updated_at)}</p>
                  </div>
                </div>
                {r.title ? <h3 className="title-sm">{r.title}</h3> : null}
                {r.body ? <p className="body-sm">{r.body.slice(0, 200)}{r.body.length > 200 ? '…' : ''}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state stack-sm">
            <p className="title-md">No reader reviews yet.</p>
            <p className="body-md">Be the first — pick anything from the catalogue and score it out of ten.</p>
            {user ? (
              <Link href="/catalog" className="text-link">Browse the catalogue →</Link>
            ) : (
              <Link href="/register" className="text-link">Create an account →</Link>
            )}
          </div>
        )}
      </section>

      {/* Instagram */}
      <section className="newsletter-band">
        <div className="container stack-lg">
          <h2 className="display-md">New ratings, new arrivals, and the odd pack shot.</h2>
          <p className="body-md" style={{ color: 'rgba(255,255,255,0.8)', maxWidth: 560 }}>
            No sponsorship, no manufacturer input, no product placement. If we ever take money
            from anyone with a stake in this industry, we will say so there first.
          </p>
          <a
            href={INSTAGRAM_URL}
            className="btn btn-primary"
            style={{ alignSelf: 'flex-start' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" />
              <circle cx="12" cy="12" r="4.2" />
              <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
            </svg>
            Follow us on Instagram
          </a>
          <p className="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>{INSTAGRAM_HANDLE}</p>
        </div>
      </section>
    </>
  );
}
