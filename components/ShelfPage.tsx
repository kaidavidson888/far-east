import { BOOKMARK } from '@/lib/cigPages';
import {
  CARD, CARD_CARET, EDITOR, GRID_MARGIN, MENU_ZOOM_MAX,
  PACK_RULE, RATE, type ShelfEntry,
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
        // every control is the mountain button's size, and the worth is
        // sized off the number one of them carries
        '--btn': `${button}px`,
        '--count-em': CARD.countEm,
        '--pack-rule': `${PACK_RULE}px`,
        // THE SIGILS ARE THE HEIGHT OF THE TOTAL PRICE NUMBER, so the worth's
        // own size is stated once here and read by both — the number and the
        // five marks — rather than written out twice and left to drift.
        '--worth-size': `calc(${button}px * ${CARD.countEm} * 1.1)`,
        '--sigil-ratio': +RATE.aspect.toFixed(4),
        '--sigil-h': `calc(var(--worth-size) * ${+RATE.em.toFixed(4)})`,
        '--sigil-w': `calc(var(--sigil-h) * var(--sigil-ratio))`,
        // the text editor: the owner's ten pixels, the rule's weight and the
        // opacity it borrows from the pack's outline, plus the two figures a
        // line of type is hung from — see EDITOR in lib/shelfGrid.ts
        '--editor-pad': `${EDITOR.pad}px`,
        '--editor-rule': `${EDITOR.rule}px`,
        '--editor-ink': EDITOR.ink,
        '--editor-fill': EDITOR.fill,
        '--editor-band': +CARD_CARET.band.toFixed(4),
        '--editor-lift': +EDITOR.lift.toFixed(4),
        // the dashed rule in the text editor's square: the margin it kept
        // off the left edge when this was a bar, and its own height
        '--card-comment-pad': `${+(button * CARD.commentPad).toFixed(3)}px`,
        '--card-caret-h': `calc((${button}px - 2 * var(--card-rule)) * ${CARD_CARET.ofStar})`,
        '--card-caret-d': `calc(var(--card-caret-h) / ${CARD_CARET.h})`,
        '--card-caret-w': `calc(var(--card-caret-h) * ${CARD_CARET.aspect})`,
        '--card-caret-x': `calc(var(--card-caret-d) * ${-CARD_CARET.x0})`,
        '--card-caret-y': `calc(var(--card-caret-d) * ${-CARD_CARET.y0})`,
        // the line under it, off the same sprite at the same scale
        '--card-rule-h': `calc(var(--card-caret-d) * ${CARD_CARET.hh})`,
        '--card-rule-x': `calc(var(--card-caret-d) * ${-CARD_CARET.hx0})`,
        '--card-rule-y': `calc(var(--card-caret-d) * ${-CARD_CARET.hy0})`,
        '--card-caret-src': `url(${CARD_CARET.src})`,
      } as React.CSSProperties}
    >
      {/* the button stands on the page's own border, not in the header: its
          10px margins are the landing page's and are measured from the edge
          of the page, where this page's own margin is 24 */}
      <ShelfMenu />

      {/*
        WHAT THE SHELF IS WORTH, in the empty half of the page beside the
        wheel: equidistant from the page's top and bottom and from its left
        edge and the pack outline's (the owner's 2026-09-21). The two marks
        point in at the number and blink; the number does not.

        THE ARROWS ARE NOT IN THE OWNER'S FACE — it carries letters, digits,
        # and $ and nothing else — so they are set in the next family in the
        stack, as the `<` of "Leave a comment <3" already is.
      */}
      <p className="shelf-worth">
        <i className="shelf-worth-arrow" aria-hidden>&gt;</i>
        <span>{worth ?? ''}</span>
        <i className="shelf-worth-arrow" aria-hidden>&lt;</i>
      </p>

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
