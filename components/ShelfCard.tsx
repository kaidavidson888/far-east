'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { togglePackAction } from '@/app/actions';
import type { ShelfEntry } from '@/lib/shelfGrid';
import { ShelfCardQuantity } from './ShelfCardQuantity';
import { ShelfCardComment } from './ShelfCardComment';
import { ShelfClouds } from './ShelfClouds';

/**
 * ONE PACK ON THE SHELF: the drawing's first card.
 *
 *   [ amount            ] [ bookmark ]   outlined, red
 *   [ the pack, with the half-black rule on its edge ]
 *   [ clouds ] [ leave a comment ... ]   outline, then solid
 *
 * IT IS A CLIENT COMPONENT FOR ONE REASON: the quantity menu has to be as
 * wide as the pack's OUTLINE, and a pack is `height: var(--pack-h); width:
 * auto` — so how wide it comes out depends on that pack's own artwork and is
 * known only once it is laid out. The ref travels down to the box that needs
 * it. Everything else here would be just as happy on the server.
 *
 * THE BOOKMARK ADDS OR REMOVES (the owner's 2026-09-21). On a cigarette's own
 * page it only ever adds — there the owner asked for red to be permanent —
 * and this is the other half of that: the one place a pack can leave the
 * shelf, and come back if the press was a mistake. The field is `pack`, which
 * is what the action reads; it was `id` until now, so the button had been
 * doing nothing at all.
 */
export function ShelfCard({
  entry: { pack, amount, unit },
  bookmark,
  saved,
}: {
  entry: ShelfEntry;
  bookmark: { mark: { width: number; height: number }; d: string };
  /** whether the pack is on the shelf right now — see ShelfGrid */
  saved: boolean;
}) {
  const packRef = useRef<HTMLAnchorElement | null>(null);

  return (
    <li className="shelf-card" data-off={saved ? undefined : ''}>
      {/* over the pack: the amount, then the bookmark */}
      <div className="shelf-card-row">
        <ShelfCardQuantity
          id={pack.id}
          name={pack.name}
          amount={amount}
          unit={unit}
          packRef={packRef}
        />
        <form action={togglePackAction} className="shelf-card-narrow">
          <input type="hidden" name="pack" value={pack.id} />
          <button
            type="submit"
            className="shelf-card-box shelf-card-mark"
            aria-pressed={saved}
            aria-label={saved
              ? `Take ${pack.name} off the shelf`
              : `Put ${pack.name} back on the shelf`}
          >
            {/* BOOKMARK.d is already moved to its own origin — the `mark` box
                is where it sits on a cigarette's page, and using that as the
                viewBox put the mark 160 units off to the left of it and the
                box came out empty. */}
            <svg
              viewBox={`0 0 ${bookmark.mark.width} ${bookmark.mark.height}`}
              aria-hidden="true"
              focusable="false"
              preserveAspectRatio="xMidYMid meet"
            >
              <path d={bookmark.d} fill="currentColor" />
            </svg>
          </button>
        </form>
      </div>

      <Link href={`/packs/${pack.id}`} className="shelf-card-pack" ref={packRef}>
        <img src={`/cigs/${pack.id}.svg`} alt={pack.name} draggable={false} />
        <span className="sr-only">{pack.name}</span>
      </Link>

      {/* under it: the clouds, then the comment bar */}
      <div className="shelf-card-row">
        <div className="shelf-card-narrow">
          <ShelfClouds label={`Open the clouds on ${pack.name}`} />
        </div>
        <div className="shelf-card-comment-slot">
          <ShelfCardComment name={pack.name} />
        </div>
      </div>
    </li>
  );
}
