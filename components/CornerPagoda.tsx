import Link from 'next/link';
import growmenu from '@/lib/growmenu-geometry.json';
import { PAGODA_GLYPH } from '@/lib/pagodaGlyph';

/**
 * THE CORNER BUTTON: the owner's pagoda in an outlined box in the page's top
 * right, and the way to the shelf — their 2026-09-23 ask, with the drawing
 * attached: "Turn the art that i attached into a simple button without the
 * circle background make it black with an outline box make it the same scale
 * as the character buttons and put it in the top right corner with 10Px
 * margins from the edge. have the button go to the shelf and fill black and
 * turn lines red on hover and click".
 *
 * IT TAKES THE CORNER THE SEAL LEFT. The 遠東 stood here until the same day,
 * when it moved to the top left and became the menu's button; this is what
 * carries the shelf link now, which that seal used to.
 *
 * "THE SAME SCALE AS THE CHARACTER BUTTONS" IS READ OFF THEIR OWN GEOMETRY
 * rather than typed again: a cell out of `lib/growmenu-geometry.json`, with
 * that menu's `badge.rule` round it, drawn at the same `--logo-menu-zoom` the
 * row publishes on the stage — so the two corners keep their ratio at every
 * width and on every pack. The MARGIN is in PAGE px, like the menu button's
 * own 10, so the stylesheet divides it by the zoom: `zoom` multiplies an
 * element's own offsets as well as its contents.
 *
 * The mark is `lib/pagodaGlyph.ts` (`npm run build:pagodaglyph`), drawn
 * inline and filled with `currentColor` — the box fills black under the
 * pointer and the lines go red, and an <img> cannot be handed a colour.
 */
const CELL = growmenu.badge?.cells?.[0];
const BOX = CELL?.w ?? 33;
const RULE = growmenu.badge?.rule ?? 2;

export function CornerPagoda() {
  return (
    <Link
      href="/shelf"
      className="corner-pagoda"
      aria-label="Your shelf"
      style={{ '--pagoda-box': `${BOX}px`, '--pagoda-rule': `${RULE}px` } as React.CSSProperties}
    >
      <svg
        viewBox={PAGODA_GLYPH.viewBox}
        width={PAGODA_GLYPH.width}
        height={PAGODA_GLYPH.height}
        aria-hidden="true"
        focusable="false"
      >
        <path d={PAGODA_GLYPH.d} fill="currentColor" fillRule={PAGODA_GLYPH.fillRule} />
      </svg>
    </Link>
  );
}
