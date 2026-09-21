import { BOOKMARK } from '@/lib/cigPages';
import {
  CARD, CARD_CARET, GRID_HEADER, GRID_MARGIN, MENU_ZOOM_MAX,
  PACK_RULE, PACK_RULE_ALPHA, type ShelfEntry,
} from '@/lib/shelfGrid';
import { ShelfMenu } from './ShelfMenu';
import { ShelfWheel } from './ShelfWheel';

/**
 * THE SHELF IS A VERTICAL WHEEL ON A RED PAGE (the owner's 2026-09-21).
 *
 * "change the way the packs are displayed from their current orientation to
 * a vertical scrolling wheel like the one on the landing page only vertical
 * rather than horizontal … change the page background to red and the outline
 * buttons and all their elements to white … make the new hover an inversion
 * of colors to black fill with white as the color of the elements inside the
 * box and no outline."
 *
 * One pack stands in the middle at all times with the next half revealed
 * above and below; the scale that makes both true at once is forced rather
 * than chosen, and comes out as a pitch of exactly half the viewport — see
 * lib/shelfWheel.ts. The three controls appear under the pack once the wheel
 * has stopped, and the number stands to its right.
 *
 * THE GRID OF CARDS IS GONE, and with it the five tracks, the four boxes to
 * a card and the rows pulled out to the pack's outline. What survives it is
 * in lib/shelfGrid.ts: the page's margin, the pack's rule, the caret's
 * sprite window and the amount's arithmetic.
 *
 * THE MOUNTAIN BUTTON stands on the page's own border at 10,10 with its
 * four-word menu — it replaced the 遠東 logo, which was this page's only way
 * back to /landing.
 */

export function ShelfPage({ entries, worth }: { entries: ShelfEntry[]; worth?: string }) {
  /** every control on this page is the mountain button's size */
  const button = 33 * MENU_ZOOM_MAX;

  return (
    <div
      className="shelf"
      style={{
        '--shelf-margin': `${GRID_MARGIN}px`,
        '--card-rule': `${CARD.rule}px`,
        '--pack-rule': `${PACK_RULE}px`,
        '--pack-rule-alpha': PACK_RULE_ALPHA,
        // the dashed rule in the text editor's square: the margin it kept
        // off the left edge when this was a bar, and its own height
        '--card-comment-pad': `${+(button * CARD.commentPad).toFixed(3)}px`,
        '--card-caret-h': `calc((${button}px - 2 * var(--card-rule)) * ${CARD_CARET.ofStar})`,
        '--card-caret-d': `calc(var(--card-caret-h) / ${CARD_CARET.h})`,
        '--card-caret-w': `calc(var(--card-caret-h) * ${CARD_CARET.aspect})`,
        '--card-caret-x': `calc(var(--card-caret-d) * ${-CARD_CARET.x0})`,
        '--card-caret-y': `calc(var(--card-caret-d) * ${-CARD_CARET.y0})`,
        '--card-caret-src': `url(${CARD_CARET.src})`,
      } as React.CSSProperties}
    >
      {/* the button stands on the page's own border, not in the header: its
          10px margins are the landing page's and are measured from the edge
          of the page, where this page's own margin is 24 */}
      <ShelfMenu />

      <header className="shelf-head" style={{ paddingTop: GRID_HEADER.top }}>
        {/* the shelf's worth, in the owner's face, white on the red ground */}
        <p className="shelf-worth" style={{ fontSize: GRID_HEADER.priceH }}>{worth ?? ''}</p>
      </header>

      {entries.length === 0 ? (
        <p className="shelf-empty">
          Nothing on the shelf yet. The bookmark on a cigarette&rsquo;s page puts it here.
        </p>
      ) : (
        <ShelfWheel entries={entries} bookmark={BOOKMARK} button={button} />
      )}
    </div>
  );
}
