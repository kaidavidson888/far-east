import data from './cigs.json';

/**
 * The row of cigarette packs that runs across the middle of the landing page.
 *
 * Everything here is measured off the two references the owner supplied — a
 * positioning SVG of the landing page with the row in place, and a recording
 * of the motion — rather than chosen. Both were measured rather than read off
 * layer boxes, the same way the rest of the page's geometry is.
 *
 * FROM THE SVG (`scripts/assets/landing-cigs.svg`, 390x844):
 *
 *   packs      x -9, 79, 167, 253, 338 at y 375-377, 53-63 wide, 90-94 high
 *   gaps       25, 25, 28, 27 between them -> 26
 *   band       y 375..469, so 375 above and 375 below: dead centre
 *   outline    a rect at 161.5,372.5 69x99 stroked 5 in #FF0000, i.e. an
 *              outer box of 74x104 around the 58x90 pack at 167,377 —
 *              8 either side, 7 above and below
 *
 * FROM THE MP4 (`scripts/assets/cig-scroll.mp4`, 1440x3118, i.e. the same
 * 390x844 at 3.692x):
 *
 *   8 fps      125ms a frame, dead constant. This is the jank the owner
 *              likes, and it is a property of the animation rather than of
 *              the recording — so the row is repainted on the same cadence
 *              instead of every rAF. See PAINT_MS.
 *   23.7 design px a frame, i.e. 189.6 px/s, constant for all 141 seconds
 *              with no easing and no snapping. Used as the reference speed
 *              a flick decays from.
 *   the outline never moves and never blinks: it is a frame at the centre
 *              of the screen that packs pass through, not a badge that
 *              travels with one.
 *   the band    is the only thing in the video (y 370.5..473.4 design),
 *              which is how we know the outer box is 104 and that nothing
 *              else on the page takes part.
 */
export type CigPack = { id: string; name: string; w: number; h: number };

const { packs, drawnHeight } = data as { packs: CigPack[]; drawnHeight: number };

export const CIG_PACKS = packs;
export const CIG_HEIGHT = drawnHeight;

/** Between one pack and the next. Measured: 25, 25, 28, 27. */
export const CIG_GAP = 26;

/**
 * The selection frame, as a margin around whichever pack it holds.
 *
 * The SVG's outline is 74x104 around a 58x90 pack. The packs here are all
 * one height but their own widths, from 38 to 80, so a fixed 74 would cut
 * into the widest of them — the margin is the part that is really fixed, and
 * the frame takes its width from the pack it is holding.
 */
export const CIG_OUTLINE = { x: 8, y: 6, stroke: 5, colour: '#ff0000' };

/** The row's own height: the outline's outer box. 92 + 6 + 6 = 104. */
export const CIG_BAND_H = CIG_HEIGHT + CIG_OUTLINE.y * 2;

/** Where each pack starts, and how long one lap is. */
export type CigLayout = { left: number[]; total: number };

export function cigLayout(list: CigPack[] = CIG_PACKS): CigLayout {
  const left: number[] = [];
  let x = 0;
  for (const p of list) {
    left.push(x);
    x += p.w + CIG_GAP;
  }
  return { left, total: x };
}

/** 125ms — the source animation's frame time. */
export const PAINT_MS = 125;

/** 23.7 design px a frame at 8fps, the speed the source runs at throughout. */
export const REFERENCE_SPEED = 189.6;
