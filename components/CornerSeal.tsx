import Link from 'next/link';
import growmenu from '@/lib/growmenu-geometry.json';
import { SEAL_GLYPH } from '@/lib/sealGlyph';

/**
 * THE CORNER SEAL: the owner's 遠東, hollowed out, in a square box in the
 * page's top right — their 2026-09-20 ask, with the seal artwork attached:
 * "turn just the chinese characters in this image into a square seal button
 * 2x as big as the mountain button in the right corner of the screen with
 * 10px margins on its top and right edges. Make the characters just a black
 * outline".
 *
 * IT IS THE MOUNTAIN BUTTON'S MIRROR, and takes its size from it rather than
 * from a number typed here: twice `logoHit.w` out of the grow menu's own
 * geometry, with that menu's rule, drawn at the same `--logo-menu-zoom` the
 * row publishes on the stage, at the same 10px margin — measured from the
 * page's top and RIGHT where the mountain takes top and left.
 *
 * **The rule stays 2px.** Doubling the box does not double its line: every
 * box on this page carries the same 2px, and the seal in the owner's artwork
 * draws its own frame at about 4% of its width, which at 66px is 2.6 — so 2
 * is both the house's line and near enough the drawing's.
 *
 * The mark is `lib/sealGlyph.ts` (`npm run build:sealglyph`), drawn inline
 * and filled with `currentColor` so that it inverts with the box under the
 * pointer, as the plus, the minus, the glass and the dots all do.
 */
const BOX = growmenu.logoHit.w * 2;
const RULE = growmenu.badge?.rule ?? 2;

export function CornerSeal() {
  const g = SEAL_GLYPH;
  return (
    <Link
      href="/shelf"
      className="corner-seal"
      aria-label="Your shelf"
      style={{ '--seal-box': `${BOX}px`, '--seal-rule': `${RULE}px` } as React.CSSProperties}
    >
      <svg viewBox={g.viewBox} width={g.width} height={g.height} aria-hidden="true" focusable="false">
        <path d={g.d} fill="currentColor" fillRule={g.fillRule} />
      </svg>
    </Link>
  );
}
