'use client';

import { useFormStatus } from 'react-dom';
import { toggleFavoriteAction } from '@/app/actions';

/**
 * The site's primary call to action. Adding is always the cinnabar primary;
 * once something is on the shelf there is nothing left to drive, so the
 * "already saved" state steps back to an outline.
 */
function Inner({ isFavorite, compact }: { isFavorite: boolean; compact: boolean }) {
  const { pending } = useFormStatus();
  const cls = [
    'btn',
    isFavorite ? 'btn-secondary' : 'btn-primary',
    'btn-block',
    compact ? 'btn-sm' : '',
  ].filter(Boolean).join(' ');

  return (
    <button type="submit" className={cls} aria-pressed={isFavorite} disabled={pending}>
      {isFavorite ? (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M3 2h10v12l-5-3.4L3 14V2Z" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 2h10v12l-5-3.4L3 14V2Z" strokeLinejoin="round" />
        </svg>
      )}
      {pending ? 'Saving…' : isFavorite ? 'On my shelf' : 'Add to my shelf'}
    </button>
  );
}

export function FavoriteButton({
  slug, isFavorite, compact = false,
}: { slug: string; isFavorite: boolean; compact?: boolean }) {
  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="slug" value={slug} />
      <Inner isFavorite={isFavorite} compact={compact} />
    </form>
  );
}
