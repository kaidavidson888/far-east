import type { CigPack } from './cigRow';
import { CIG_BRAKE, CIG_FLING_MAX, CIG_FLING_WINDOW_MS, PAINT_MS } from './cigRow';
import { GRID_GUTTER, PACK_RULE } from './shelfGrid';

/**
 * THE SHELF IS A VERTICAL WHEEL (the owner's 2026-09-21: "change the way the
 * packs are displayed from their current orientation to a vertical scrolling
 * wheel like the one on the landing page only vertical rather than
 * horizontal").
 *
 * EVERY PACK IS THE SAME WIDTH, NOT THE SAME HEIGHT (the owner's later "make
 * all the packs the same width not the same height[,] scale the wheel and the
 * packs to adjust"). That is the opposite of everywhere else packs are drawn
 * on this site — the landing row and the grid that stood here both stand them
 * at one HEIGHT — and it is what turns this wheel's arithmetic into the row's
 * rather than something simpler: a pack's along-axis extent is its own again,
 * so the wheel carries an ARRAY of positions where it used to carry one
 * pitch.
 *
 * The marks are all drawn 92 units tall and 40..108 wide, so at one width
 * their heights run 0.85 to 2.30 of it across the catalogue; on the fixture's
 * six the spread is 1.53 to 1.84.
 */

/**
 * ONE MARGIN, EVERYWHERE (the owner's "scale the packs down to match the
 * original margin constraints between them while keeping the buttons
 * equidistant").
 *
 * The three controls stand in the gap under the pack, so the gap is not just
 * pack-to-pack: it is margin, buttons, margin. Held at the drawing's own 35
 * the buttons had 5.95px of air either side, which is not a margin — it is
 * what was left over. So the MARGIN is the constant and the GAP falls out of
 * it. The buttons stay equidistant by construction: one margin above them,
 * one below.
 */
export const WHEEL_MARGIN = GRID_GUTTER;

/** Pack to pack: a margin, the row of controls, a margin. */
export function wheelGap(button: number): number {
  return WHEEL_MARGIN * 2 + button;
}

/**
 * HOW WIDE EVERY PACK IS DRAWN.
 *
 * THE HALF-REVEALED RULE CANNOT HOLD EXACTLY FOR EVERY PACK ANY MORE, and
 * that is arithmetic rather than a decision. With pack i centred, the one
 * below it is exactly half revealed when
 *
 *      H/2 = P_i/2 + 2r + G + P_j/2
 *
 * so `P_i + P_j` has to be the same for EVERY adjacent pair — which is only
 * true if every pack is the same height, and that is precisely what has
 * stopped being true. So the width is set so the rule holds exactly for a
 * pack of the shelf's MEAN height: a taller one then shows a little under
 * half and a shorter one a little over. It was 50.0% everywhere while the
 * heights were equal; the honest figure now is a range.
 *
 * TWO CLAMPS, and both only ever make it smaller: the tallest pack on the
 * shelf has to fit the screen with a margin top and bottom, and the width has
 * to leave room for the number square standing off the pack's right edge.
 */
export function wheelWidth(
  viewportH: number,
  viewportW: number,
  button: number,
  ratios: number[],
): number {
  if (!ratios.length) return 1;
  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  const tallest = Math.max(...ratios);
  /** the height the original rule asks of a mean pack */
  const want = viewportH / 2 - 2 * PACK_RULE - wheelGap(button);
  const byMean = want / mean;
  const byTallest = (viewportH - 2 * WHEEL_MARGIN - 2 * PACK_RULE) / tallest;
  const byRoom = viewportW - 2 * PACK_RULE - 3 * WHEEL_MARGIN - button;
  return Math.max(24, Math.min(byMean, byTallest, byRoom));
}

/**
 * Where each pack sits on the wheel, and how long one lap is.
 *
 * `pos` is the middle of each pack's IMAGE along the wheel — what the settle
 * aims at and what the page puts on the screen's middle. Consecutive image
 * boxes stand `2r + G` apart: the two rules, which are drawn outside their
 * pictures, and the gap.
 */
export function wheelLayout(ratios: number[], width: number, button: number) {
  const step = 2 * PACK_RULE + wheelGap(button);
  const pos: number[] = [];
  const height: number[] = [];
  let y = 0;
  for (const r of ratios) {
    const h = width * r;
    height.push(h);
    pos.push(y + h / 2);
    y += h + step;
  }
  return { pos, height, total: y };
}

/**
 * HOW MANY COPIES OF THE SHELF THE WHEEL TURNS THROUGH.
 *
 * The loop is modular: the offset is taken modulo one lap and enough laps are
 * drawn to cover the screen. A lap shorter than the screen would put the SAME
 * pack at the top and the bottom at once, which a shelf of two would do, so
 * the list is repeated until a lap is comfortably longer than the screen.
 *
 * A shelf of one is the case the arithmetic cannot save: repeated, it is
 * still the same pack above and below. That is honest — there is only one.
 */
export function wheelCopies(lap: number, viewportH: number): number {
  if (!(lap > 0)) return 1;
  return Math.max(1, Math.ceil((viewportH * 1.5) / lap) + 1);
}

/** Motion, borrowed whole from the row so the two feel the same. */
export const WHEEL_MOTION = {
  /** the 8fps beat the owner's own recording runs at */
  paintMs: PAINT_MS,
  brake: CIG_BRAKE,
  flingMax: CIG_FLING_MAX,
  flingWindowMs: CIG_FLING_WINDOW_MS,
  /** row px per wheel-delta px */
  wheel: 0.8,
  /** below this the glide is spent and the settle takes over */
  settleBelow: 25,
  /** the settle's time constant */
  settleTau: 0.2,
  /** pressing a pack to bring it to the middle: the owner's 200% */
  seekTau: 0.1,
  /** past this a press was a drag, not a click */
  slop: 6,
  /** render overscan, in page px */
  pad: 120,
} as const;

export type WheelPack = CigPack;
