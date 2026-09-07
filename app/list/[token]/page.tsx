import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser, shelfName } from '@/lib/auth';
import { profileById, shareByToken, shareItems } from '@/lib/db';
import { formatMoment } from '@/lib/format';
import { PackShot } from '@/components/PackShot';
import { ScoreSeal } from '@/components/ScoreSeal';
import { SealDivider } from '@/components/SealDivider';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SurfacePreference } from '@/components/SurfacePreference';

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const share = await shareByToken(token);
  if (!share || share.revoked_at) return { title: 'Link no longer active' };
  const owner = await profileById(share.user_id);
  if (!owner) return { title: 'Link no longer active' };
  return {
    title: shelfName(owner.display_name),
    description: `A Far East shelf shared by ${owner.display_name}.`,
  };
}

export default async function SharedListPage({ params }: Params) {
  const { token } = await params;
  const share = await shareByToken(token);
  if (!share) notFound();

  const owner = await profileById(share.user_id);
  if (!owner) notFound();

  if (share.revoked_at) {
    return (
      <>
        <SurfacePreference mode="dark" />
        <div className="container band stack-lg">
          <span className="label muted">Shelf</span>
          <h1 className="display-lg">This link is no longer active.</h1>
          <p className="body-lg measure">
            Whoever shared it has cancelled it. If they generate a new one, it will have a
            different address — this one will not start working again.
          </p>
          <Link href="/catalog" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
            Browse the catalogue
          </Link>
        </div>
      </>
    );
  }

  const items = await shareItems(share.id);
  const viewer = await currentUser();
  const isOwner = viewer?.id === owner.id;
  const generatedAt = formatMoment(share.created_at);

  return (
    <>
      <SurfacePreference mode="dark" />
      <div className="container band-sm stack-xl">
        <header className="stack-md">
          <span className="label muted">A shared shelf</span>
          <h1 className="display-lg">{shelfName(owner.display_name)}</h1>
          <div className="row wrap" style={{ gap: 'var(--md)' }}>
            <span className="avatar" aria-hidden="true">{owner.display_name.slice(0, 1).toUpperCase()}</span>
            <div>
              <p className="title-sm">{owner.display_name}</p>
              <p className="caption">
                {items.length} {items.length === 1 ? 'cigarette' : 'cigarettes'}
                {isOwner ? ' · this is your shelf' : ''}
              </p>
            </div>
          </div>
          <SealDivider short />
          <p className="tested-stamp">Shelf as it stood on {generatedAt}</p>
          <div className="row wrap" style={{ gap: 'var(--sm)' }}>
            <CopyLinkButton path={`/list/${token}`} label="Copy this shelf's link" />
            <Link href="/catalog" className="btn btn-ghost">Browse the catalogue</Link>
          </div>
        </header>

        {items.length ? (
          <ol className="stack-lg">
            {items.map(({ cigarette: c, note, rating, review_title }, i) => (
              <li key={c.id} className="card card-pad" style={{ display: 'grid', gridTemplateColumns: '56px 160px 1fr', gap: 'var(--lg)' }}>
                <span className="display-md muted" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <Link href={`/cigarette/${c.slug}`} aria-label={c.name}>
                  <PackShot name={c.name} brand={c.brand} cjk={c.cjk} strength={c.strength} />
                </Link>
                <div className="stack-sm">
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div className="grow stack-xs">
                      <span className="label muted">{c.brand} · {c.country}</span>
                      <Link href={`/cigarette/${c.slug}`} className="title-lg">{c.name}</Link>
                      <p className="body-sm">{c.summary}</p>
                    </div>
                    <ScoreSeal score={c.userAvg} size="sm" />
                  </div>
                  {note ? (
                    <blockquote className="body-md" style={{ borderLeft: '3px solid var(--cinnabar)', paddingLeft: 'var(--md)', whiteSpace: 'pre-wrap' }}>
                      {note}
                    </blockquote>
                  ) : null}
                  {rating != null ? (
                    <p className="caption">
                      {owner.display_name} scored this {rating}/10
                      {review_title ? ` — “${review_title}”` : ''}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state stack-sm">
            <p className="title-lg">This shelf was empty when the link was made.</p>
            <p className="body-md">Nothing had been added to it yet.</p>
          </div>
        )}

        <div className="card card-pad stack-sm">
          <h2 className="title-lg">Build your own shelf</h2>
          <p className="body-md measure">
            Reading is open to everyone. An account lets you rate and review anything in the
            catalogue and keep a shelf like this one, shareable with a single link.
          </p>
          <div className="row wrap" style={{ gap: 'var(--sm)' }}>
            <Link href="/register" className="btn btn-primary">Create an account</Link>
            <Link href="/catalog" className="btn btn-secondary">Browse the catalogue</Link>
          </div>
        </div>
      </div>
    </>
  );
}
