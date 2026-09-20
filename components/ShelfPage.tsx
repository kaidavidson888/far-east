import Link from 'next/link';
import { removePackAction } from '@/app/actions';
import { BOOKMARK } from '@/lib/cigPages';
import { HOME } from '@/lib/innerPage';
import {
  CARD, CARD_COMMENT, GRID_GUTTER, GRID_HEADER, GRID_LOGO, GRID_MARGIN,
  PACK_RULE, PACK_RULE_ALPHA, type ShelfEntry,
} from '@/lib/shelfGrid';
import { ShelfClouds } from './ShelfClouds';
import { ShelfCardQuantity } from './ShelfCardQuantity';

/**
 * THE SHELF, REDRAWN AS A GRID (the owner's 2026-09-20 redraw): the 遠東 logo
 * top left, what the shelf is worth top right in red, and every saved pack as
 * a card — no more than five to a row on a desktop and three on a phone.
 *
 * THE CARD IS THE DRAWING'S FIRST PACK, which is the only one drawn with its
 * whole interface ("look at the first cigarette pack with the full UI and use
 * that as a model for all the others"). Two outlined boxes over the pack — the
 * amount and the bookmark — and two under it — the clouds and a solid red
 * comment bar. The narrow box swaps sides between the rows, bookmark top right
 * and clouds bottom left, and each row spans exactly the pack's width.
 *
 * WHAT WENT, AND WHY. The old shelf drew one pack to a line with its boxes,
 * panel and clouds beside it, and a fixed-point solver sized the line so it
 * ended exactly on the $ sign. None of that survives a grid: the tracks are
 * equal by construction and there is nothing to solve. lib/shelfGrid.ts holds
 * the numbers, each one saying which measurement of the drawing it came from
 * and where it was evened up.
 *
 * IT IS LAID OUT IN CSS, NOT MEASURED IN JAVASCRIPT. The old page had to
 * measure, because a row's width depended on the widest pack the reader had
 * saved. A grid of equal tracks is equal at any size, so the column count is a
 * media query and every distance on a card is a fraction of the pack's own
 * height — which means the page arrives laid out rather than re-laying itself
 * once the client has measured.
 *
 * THE AMOUNT BOX IS THE QUANTITY CONTROL, because the drawing has no plus on
 * it and printing the amount alone would take away the only way to change it;
 * pressing it opens the same wheels the cigarette page's plus opens. The
 * bookmark is the other half of that page's: there it only ever adds, so here
 * it takes the pack off the shelf. The comment bar is drawn and inert — the
 * pack shelf has nowhere to keep a note, which was true of the old panel too.
 *
 * THE LOGO GOES HOME. Every page but the landing page and the splash sends it
 * to /landing.
 */

export function ShelfPage({ entries, worth }: { entries: ShelfEntry[]; worth?: string }) {
  return (
    <div
      className="shelf"
      style={{
        '--shelf-margin': `${GRID_MARGIN}px`,
        '--shelf-gutter': `${GRID_GUTTER}px`,
        '--card-box-h': `calc(var(--pack-h) * ${CARD.boxH})`,
        '--card-drop': `calc(var(--pack-h) * ${CARD.drop})`,
        '--card-gap': `calc(var(--card-box-h) * ${CARD.gap})`,
        '--card-rule': `${CARD.rule}px`,
        '--pack-rule': `${PACK_RULE}px`,
        '--pack-rule-alpha': PACK_RULE_ALPHA,
      } as React.CSSProperties}
    >
      <header className="shelf-head" style={{ paddingTop: GRID_HEADER.top }}>
        <Link href={HOME} className="shelf-logo" aria-label="Far East, back to the landing page">
          <img
            src="/landing/parts/logo.svg"
            alt=""
            width={GRID_LOGO.w}
            height={GRID_LOGO.h}
            draggable={false}
          />
        </Link>
        {/* the shelf's worth, in the owner's face, in the artwork's own red */}
        <p className="shelf-worth" style={{ fontSize: GRID_HEADER.priceH }}>{worth ?? ''}</p>
      </header>

      <div className="shelf-divider" role="presentation" />

      {entries.length === 0 ? (
        <p className="shelf-empty">
          Nothing on the shelf yet. The bookmark on a cigarette&rsquo;s page puts it here.
        </p>
      ) : (
        <ul className="shelf-grid" style={{ marginTop: GRID_HEADER.drop }}>
          {entries.map(({ pack, amount, unit }) => (
            <li className="shelf-card" key={pack.id}>
              {/* over the pack: the amount, then the bookmark */}
              <div className="shelf-card-row">
                <ShelfCardQuantity id={pack.id} name={pack.name} amount={amount} unit={unit} />
                <form action={removePackAction} className="shelf-card-narrow">
                  <input type="hidden" name="id" value={pack.id} />
                  <button
                    type="submit"
                    className="shelf-card-box shelf-card-mark"
                    aria-label={`Take ${pack.name} off the shelf`}
                  >
                    {/* BOOKMARK.d is already moved to its own origin — the
                        `mark` box is where it sits on a cigarette's page, and
                        using that as the viewBox put the mark 160 units off
                        to the left of it and the box came out empty. */}
                    <svg
                      viewBox={`0 0 ${BOOKMARK.mark.width} ${BOOKMARK.mark.height}`}
                      aria-hidden="true"
                      focusable="false"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <path d={BOOKMARK.d} fill="currentColor" />
                    </svg>
                  </button>
                </form>
              </div>

              <Link href={`/packs/${pack.id}`} className="shelf-card-pack">
                <img src={`/cigs/${pack.id}.svg`} alt={pack.name} draggable={false} />
                <span className="sr-only">{pack.name}</span>
              </Link>

              {/* under it: the clouds, then the comment bar */}
              <div className="shelf-card-row">
                <div className="shelf-card-narrow">
                  <ShelfClouds label={`Open the clouds on ${pack.name}`} />
                </div>
                <div className="shelf-card-comment-slot">
                  <p className="shelf-card-comment">{CARD_COMMENT}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
