import Link from 'next/link';
import type { Cigarette } from '@/lib/db';
import { PackShot } from './PackShot';
import { ScoreSeal } from './ScoreSeal';
import { FavoriteButton } from './FavoriteButton';

export function ProductCard({
  cigarette: c, isFavorite, footer,
}: {
  cigarette: Cigarette;
  isFavorite: boolean;
  /** Extra controls below the shelf button — the shelf uses it for notes. */
  footer?: React.ReactNode;
}) {
  return (
    <article className="product-card">
      <Link href={`/cigarette/${c.slug}`} aria-label={`${c.name} — read the review`}>
        <div className="pc-media">
          <PackShot name={c.name} brand={c.brand} cjk={c.cjk} strength={c.strength} />
          <ScoreSeal score={c.userAvg} size="sm" />
        </div>
        <div className="pc-body stack-sm">
          <div className="row" style={{ gap: 'var(--xs)' }}>
            <span className="label muted">{c.brand}</span>
            <span className="caption">·</span>
            <span className="caption">{c.country}</span>
          </div>
          <h3 className="title-lg pc-name">{c.name}</h3>
          <p className="body-sm">{c.summary}</p>
        </div>
      </Link>
      <div className="row-between" style={{ marginTop: 'var(--md)', paddingTop: 'var(--md)', borderTop: '1px solid var(--hairline)' }}>
        <span className="mono-sm muted">{c.tar_mg} mg tar · {c.length_mm} mm</span>
        <span className="caption">
          {c.userCount > 0
            ? `${c.userCount} ${c.userCount === 1 ? 'rating' : 'ratings'}`
            : 'Not rated yet'}
        </span>
      </div>
      <div style={{ marginTop: 'var(--md)' }}>
        <FavoriteButton slug={c.slug} isFavorite={isFavorite} compact />
      </div>
      {footer ? <div style={{ marginTop: 'var(--sm)' }}>{footer}</div> : null}
    </article>
  );
}
