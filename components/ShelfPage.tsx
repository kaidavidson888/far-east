import Link from 'next/link';
import { BOOKMARK } from '@/lib/cigPages';
import { HOME } from '@/lib/innerPage';
import {
  CARD, CARD_CARET, CARD_COMMENT_EM, GRID_GUTTER, GRID_HEADER, GRID_LOGO, GRID_MARGIN,
  PACK_RULE, PACK_RULE_ALPHA, type ShelfEntry,
} from '@/lib/shelfGrid';
import { ShelfGrid } from './ShelfGrid';

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
 * and clouds bottom left.
 *
 * THE ROWS SPAN THE OUTLINE, NOT THE PICTURE (2026-09-21). The half-black rule
 * is drawn outside the image, so each row is pulled out by exactly that rule
 * and its ends land on the outline's outer edges.
 *
 * WHAT WENT, AND WHY. The old shelf drew one pack to a line with its boxes,
 * panel and clouds beside it, and a fixed-point solver sized the line so it
 * ended exactly on the $ sign. None of that survives a grid: the tracks are
 * equal by construction and there is nothing to solve. lib/shelfGrid.ts holds
 * the numbers, each one saying which measurement of the drawing it came from
 * and where it was evened up.
 *
 * THE LOGO GOES HOME. Every page but the landing page and the splash sends it
 * to /landing. The red rule that used to run beneath it came off on
 * 2026-09-21 — it was the site's own divider, never in the export.
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
        '--card-amount-em': CARD.amountEm,
        '--pack-rule': `${PACK_RULE}px`,
        '--pack-rule-alpha': PACK_RULE_ALPHA,
        // the comment bar: the margin the phrase already had, and the size
        // that makes the phrase fit between two of them (see CARD_COMMENT_EM)
        '--card-comment-pad': `calc(var(--card-box-h) * ${CARD.commentPad})`,
        '--card-comment-em': CARD_COMMENT_EM,
        // THE HAND-DRAWN CARET, as one window onto the login box's own sprite.
        // `--caret-d` is how wide the whole 430px sprite is drawn to make the
        // window come out at the height wanted; every other number is that
        // scale times the window's own fraction.
        '--card-caret-h': `calc((var(--card-box-h) - 2 * var(--card-rule)) * ${CARD_CARET.ofStar})`,
        '--card-caret-d': `calc(var(--card-caret-h) / ${CARD_CARET.h})`,
        '--card-caret-w': `calc(var(--card-caret-h) * ${CARD_CARET.aspect})`,
        '--card-caret-x': `calc(var(--card-caret-d) * ${-CARD_CARET.x0})`,
        '--card-caret-y': `calc(var(--card-caret-d) * ${-CARD_CARET.y0})`,
        '--card-caret-src': `url(${CARD_CARET.src})`,
        // the typed run, set so its whole band is the caret's height
        '--card-typed': `calc(var(--card-caret-h) / ${CARD_CARET.band})`,
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

      {entries.length === 0 ? (
        <p className="shelf-empty">
          Nothing on the shelf yet. The bookmark on a cigarette&rsquo;s page puts it here.
        </p>
      ) : (
        <ShelfGrid
          entries={entries}
          bookmark={BOOKMARK}
          style={{ marginTop: GRID_HEADER.drop }}
        />
      )}
    </div>
  );
}
