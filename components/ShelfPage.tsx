import Link from 'next/link';
import { removePackAction } from '@/app/actions';
import { BOOKMARK } from '@/lib/cigPages';
import { HOME } from '@/lib/innerPage';
import {
  CARD_BOX, GRID_FOOT, GRID_GUTTER, GRID_HEADER, GRID_LOGO, GRID_MARGIN,
  PACK_RULE, PACK_RULE_ALPHA, PACK_RULE_INSET, cardBoxes,
} from '@/lib/shelfGrid';
import type { ShelfEntry } from '@/lib/shelfGrid';
import { ShelfClouds } from './ShelfClouds';
import { ShelfCardQuantity } from './ShelfCardQuantity';

/**
 * THE SHELF, REDRAWN AS A GRID (the owner's 2026-09-20 redraw, from a mobile
 * comp): the 遠東 logo top left, what the shelf is worth top right in red, and
 * then every saved pack as a card — no more than five to a row on a desktop
 * and three on a phone — over a red outline at the foot holding the five
 * clouds, which open when it is hovered or pressed.
 *
 * WHAT WENT, AND WHY. The old shelf drew one pack to a line with its boxes,
 * panel and clouds beside it, and a fixed-point solver sized the line so it
 * ended exactly on the $ sign. None of that survives a grid: the tracks are
 * equal by construction and there is nothing to solve. lib/shelfGrid.ts holds
 * the numbers, each one saying which measurement of the drawing it came from
 * and where it was evened up — the owner's note being that the drawing "may
 * be subject to human error".
 *
 * IT IS LAID OUT IN CSS, NOT MEASURED IN JAVASCRIPT. The old page had to
 * measure, because the row's width depended on the widest pack on the shelf
 * and the zoom depended on the row's width. A grid of equal tracks is a grid
 * of equal tracks at any size, so the column count is a media query and the
 * rest is `fr` — which also means the page arrives laid out rather than
 * re-laying itself once the client has measured.
 *
 * TWO BOXES OVER EACH PACK, as drawn: a wide one carrying the amount and a
 * narrow one carrying the bookmark, together exactly the pack's width. The
 * amount is the quantity CONTROL — pressing it opens the same wheels the
 * cigarette page's plus does — because the drawing has no plus on it and
 * dropping the ability to change a quantity would be a loss the redraw never
 * asked for. The bookmark is the other half of the cigarette page's: there it
 * only ever adds, so here it takes the pack off the shelf.
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
          {entries.map(({ pack, amount, unit }) => {
            const boxes = cardBoxes(1000);
            const share = boxes.amount / 1000;
            return (
              <li className="shelf-card" key={pack.id}>
                <div className="shelf-card-boxes" style={{ height: CARD_BOX.height, gap: CARD_BOX.gap }}>
                  <ShelfCardQuantity
                    id={pack.id}
                    name={pack.name}
                    amount={amount}
                    unit={unit}
                    grow={share}
                    height={CARD_BOX.height}
                    rule={CARD_BOX.rule}
                  />
                  <form action={removePackAction} className="shelf-card-drop">
                    <input type="hidden" name="id" value={pack.id} />
                    <button
                      type="submit"
                      className="shelf-card-mark"
                      style={{ borderWidth: CARD_BOX.rule }}
                      aria-label={`Take ${pack.name} off the shelf`}
                    >
                      <svg
                        /* the mark's own box out of the vector, so the path is
                           drawn at the coordinates it was measured at */
                        viewBox={`${BOOKMARK.mark.left} ${BOOKMARK.mark.top} ${BOOKMARK.mark.width} ${BOOKMARK.mark.height}`}
                        width={BOOKMARK.mark.width}
                        height={BOOKMARK.mark.height}
                        aria-hidden="true"
                        focusable="false"
                        preserveAspectRatio="xMidYMid meet"
                      >
                        <path d={BOOKMARK.d} fill="currentColor" />
                      </svg>
                    </button>
                  </form>
                </div>

                <Link
                  href={`/packs/${pack.id}`}
                  className="shelf-card-pack"
                  style={{
                    marginTop: CARD_BOX.drop,
                    '--pack-rule': `${PACK_RULE}px`,
                    '--pack-rule-inset': `${PACK_RULE_INSET}px`,
                    '--pack-rule-alpha': PACK_RULE_ALPHA,
                  } as React.CSSProperties}
                >
                  <img src={`/cigs/${pack.id}.svg`} alt={pack.name} draggable={false} />
                  <span className="sr-only">{pack.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* THE OUTLINE AT THE FOOT, and the clouds that open inside it */}
      <div
        className="shelf-foot"
        style={{
          marginTop: GRID_FOOT.drop,
          borderWidth: GRID_FOOT.rule,
          padding: GRID_FOOT.pad,
        }}
      >
        <ShelfClouds size={GRID_FOOT.clouds} label="Open the clouds" />
      </div>
    </div>
  );
}
