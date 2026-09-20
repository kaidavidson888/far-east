import Link from 'next/link';
import growmenu from '@/lib/growmenu-geometry.json';
import { SEAL_GLYPHS } from '@/lib/sealGlyph';

/**
 * THE CORNER SEAL: the owner's 遠 and 東, hollowed out, each in its own square
 * in the page's top right — their 2026-09-20 asks, with the seal artwork
 * attached. First: "turn just the chinese characters in this image into a
 * square seal button 2x as big as the mountain button in the right corner of
 * the screen with 10px margins on its top and right edges. Make the
 * characters just a black outline". Then: "stretch the characters so they are
 * a square together", and then "make them two seperate characters in square
 * outlines and scale them to be individually square but make them 1 button
 * with 5px margin between".
 *
 * SO IT IS TWO BOXES AND ONE CONTROL. Each box is the size the seal was as a
 * whole — twice the mountain button's, taken from that menu's own geometry
 * rather than a number typed here — and each holds one character filling it.
 * Between them is the owner's 5px, in PAGE px like the margins on the same
 * button: the stylesheet divides it by the zoom, so it is 5 on the screen at
 * any width, while the boxes themselves scale with the row as the mountain
 * does. One `<Link>` wraps the pair, so there is one press target, one focus
 * ring and one hover — both boxes invert together.
 *
 * The marks are `lib/sealGlyph.ts` (`npm run build:sealglyph`), drawn inline
 * and filled with `currentColor` so they follow the boxes, as the plus, the
 * minus, the glass and the dots all do.
 */
const BOX = growmenu.logoHit.w * 2;
const RULE = growmenu.badge?.rule ?? 2;

export function CornerSeal() {
  return (
    <Link
      href="/shelf"
      className="corner-seal"
      aria-label="Your shelf"
      style={{ '--seal-box': `${BOX}px`, '--seal-rule': `${RULE}px` } as React.CSSProperties}
    >
      {SEAL_GLYPHS.map((g, i) => (
        <span className="corner-seal-box" key={i}>
          <svg viewBox={g.viewBox} width={g.width} height={g.height} aria-hidden="true" focusable="false">
            <path d={g.d} fill="currentColor" fillRule={g.fillRule} />
          </svg>
        </span>
      ))}
    </Link>
  );
}
