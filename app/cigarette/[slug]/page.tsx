import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  favoriteIds, getCigaretteBySlug, listCigarettes, reviewByUser, reviewsForCigarette,
} from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PackShot } from '@/components/PackShot';
import { ProductCard } from '@/components/ProductCard';
import { ReviewForm } from '@/components/ReviewForm';
import { ScoreSeal } from '@/components/ScoreSeal';
import { SealDivider } from '@/components/SealDivider';
import { SurfacePreference } from '@/components/SurfacePreference';
import { formatDate } from '@/lib/format';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCigaretteBySlug(slug);
  if (!c) return { title: 'Not found' };
  return { title: `${c.name} review`, description: c.summary };
}

export default async function CigarettePage({ params }: Params) {
  const { slug } = await params;
  const c = await getCigaretteBySlug(slug);
  if (!c) notFound();

  const user = await currentUser();
  const reviews = await reviewsForCigarette(c.id);
  const mine = user ? await reviewByUser(user.id, c.id) : null;
  const favorites = new Set(user ? await favoriteIds(user.id) : []);
  const isFavorite = favorites.has(c.id);
  const related = (await listCigarettes({ country: [c.country] }))
    .filter((r) => r.id !== c.id).slice(0, 3);

  const specs: [string, string][] = [
    ['Tar', `${c.tar_mg} mg`],
    ['Nicotine', `${c.nicotine_mg} mg`],
    ['Length', `${c.length_mm} mm`],
    ['Pack', `${c.pack_size}`],
    ['Strength', c.strength],
    ['Flavour', c.flavour],
    ['Format', c.format],
    ['Filter', c.filter_type],
  ];

  return (
    <>
      <SurfacePreference mode="light" />

      {/* product-hero */}
      <section className="container" style={{ paddingBlock: 'var(--xxl)' }}>
        <div className="review-layout">
          <div className="stack-lg">
            <nav className="row wrap caption" style={{ gap: 'var(--xs)' }} aria-label="Breadcrumb">
              <Link href="/catalog" className="text-link">Catalogue</Link>
              <span aria-hidden="true">·</span>
              <Link href={`/catalog?country=${encodeURIComponent(c.country)}`} className="caption">{c.country}</Link>
              <span aria-hidden="true">·</span>
              <Link href={`/catalog?brand=${encodeURIComponent(c.brand)}`} className="caption">{c.brand}</Link>
            </nav>

            <PackShot name={c.name} brand={c.brand} cjk={c.cjk} strength={c.strength} ratio="3:2" />

            <div className="stack-md">
              <h1 className="display-lg">
                {c.name}
                {c.cjk ? <span className="cjk display-md" style={{ marginLeft: 'var(--md)' }}>{c.cjk}</span> : null}
              </h1>
              <p className="body-lg measure">{c.summary}</p>
              <p className="caption">In production since {c.year}</p>
            </div>

            <p className="disclosure">
              Far East buys every product it reviews at retail. We take no money from tobacco
              manufacturers, run no affiliate links and sell nothing. Prices shown are indicative
              retail in the product&rsquo;s home market.
            </p>
          </div>

          {/* sticky rail */}
          <aside className="sticky-rail stack-md">
            <ScoreSeal score={c.userAvg} />
            <p className="caption">
              {c.userCount
                ? `Average of ${c.userCount} reader ${c.userCount === 1 ? 'rating' : 'ratings'}`
                : 'No reader ratings yet — yours would be the first.'}
            </p>

            <FavoriteButton slug={c.slug} isFavorite={isFavorite} />
            {!user ? (
              <p className="caption">
                <Link href={`/login?next=/cigarette/${c.slug}`} className="inline-link">Sign in</Link> or{' '}
                <Link href="/register" className="inline-link">create an account</Link> to save it.
              </p>
            ) : null}

            <div className="price-row">
              <span className="title-sm">{c.market}</span>
              <span className="spec-value">${c.price_usd.toFixed(2)}</span>
            </div>
            <p className="caption">Indicative pack price · checked March 2026</p>

            <nav className="stack-sm" aria-label="On this page">
              <span className="label muted" style={{ display: 'block' }}>Jump to</span>
              <ul className="jump-links stack-xs">
                <li><a href="#verdict" className="ui">Our notes</a></li>
                  <li><a href="#specs" className="ui">Specifications</a></li>
                <li><a href="#readers" className="ui">Reader reviews</a></li>
              </ul>
            </nav>
          </aside>
        </div>
      </section>

      {/* verdict */}
      <section className="container" style={{ paddingBottom: 'var(--xxl)' }}>
        <div className="verdict-card measure stack-lg" id="verdict">
          <h2 className="title-lg">Our notes</h2>
          {c.verdict.split('\n\n').map((p, i) => (
            <p key={i} className="body-lg">{p}</p>
          ))}
          <div className="pros-cons">
            <div className="stack-sm">
              <span className="label" style={{ color: 'var(--positive)' }}>What works</span>
              <ul className="pc-list stack-xs body-md">
                {c.pros.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <div className="stack-sm">
              <span className="label" style={{ color: 'var(--negative)' }}>What does not</span>
              <ul className="pc-list cons stack-xs body-md">
                {c.cons.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* specs */}
      <section className="container" style={{ paddingBottom: 'var(--xxl)' }} id="specs">
        <div className="stack-lg">
          <h2 className="display-sm">Specifications</h2>
          <div className="spec-grid">
            {specs.map(([label, value]) => (
              <div key={label} className="spec-cell">
                <p className="spec-value">{value}</p>
                <p className="label">{label}</p>
              </div>
            ))}
          </div>
          <p className="caption measure">
            Tar and nicotine are the manufacturer or market-label declarations, measured by
            machine under ISO conditions. They do not describe what any individual smoker
            inhales.
          </p>
        </div>
      </section>

      {/* health */}
      <section className="container" style={{ paddingBottom: 'var(--xxl)' }}>
        <p className="health-band-strong body-md measure">
          <strong>Smoking kills.</strong> A high reader rating means people who smoke it like it.
          It does not mean it is safe, and no cigarette in this catalogue is safer than any other.
        </p>
      </section>

      <div className="container"><SealDivider /></div>

      {/* reader reviews */}
      <section className="container band-sm stack-xl" id="readers">
        <div className="row-between wrap">
          <h2 className="display-sm">Reader reviews</h2>
          {c.userCount ? (
            <p className="ui muted">
              <strong className="ink">{c.userAvg}</strong> average from {c.userCount} {c.userCount === 1 ? 'reader' : 'readers'}
            </p>
          ) : null}
        </div>

        <div className="review-layout">
          <div className="stack-lg">
            {reviews.length ? (
              reviews.map((r) => (
                <article key={r.id} className="review-card stack-sm">
                  <div className="row">
                    <span className="avatar" aria-hidden="true">{r.display_name.slice(0, 1).toUpperCase()}</span>
                    <div className="grow">
                      <p className="title-sm">{r.display_name}{user && r.user_id === user.id ? ' · you' : ''}</p>
                      <p className="caption">{formatDate(r.updated_at)}</p>
                    </div>
                    <ScoreSeal score={r.rating} size="xs" label={`${r.display_name}'s score`} />
                  </div>
                  {r.title ? <h3 className="title-md">{r.title}</h3> : null}
                  {r.body ? <p className="body-md" style={{ whiteSpace: 'pre-wrap' }}>{r.body}</p> : null}
                </article>
              ))
            ) : (
              <div className="empty-state stack-sm">
                <p className="title-md">No reader reviews yet.</p>
                <p className="body-md">Yours would be the first.</p>
              </div>
            )}
          </div>

          <div className="stack-md">
            <ReviewForm
              slug={c.slug}
              signedIn={!!user}
              existing={mine ? { rating: mine.rating, title: mine.title, body: mine.body } : null}
            />
          </div>
        </div>
      </section>

      {/* related */}
      {related.length ? (
        <section className="container" style={{ paddingBottom: 'var(--section)' }}>
          <div className="row-between wrap" style={{ marginBottom: 'var(--xl)' }}>
            <h2 className="display-sm">Also from {c.country}</h2>
            <Link href={`/catalog?country=${encodeURIComponent(c.country)}`} className="text-link">See all →</Link>
          </div>
          <div className="grid-cards">
            {related.map((r) => (
              <ProductCard key={r.id} cigarette={r} isFavorite={favorites.has(r.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
