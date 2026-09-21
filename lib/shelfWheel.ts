import type { CigPack } from './cigRow';
import { CIG_BRAKE, CIG_FLING_MAX, CIG_FLING_WINDOW_MS, PAINT_MS } from './cigRow';
import { GRID_GUTTER, PACK_RULE } from './shelfGrid';

/**
 * THE SHELF IS A VERTICAL WHEEL (the owner's 2026-09-21: "change the way the
 * packs are displayed from their current orientation to a vertical scrolling
 * wheel like the one on the landing page only vertical rather than
 * horizontal").
 *
 * THE SCALE IS NOT CHOSEN — IT IS FORCED, by the owner's two constraints
 * together: "one pack is in the middle of the screen at all times and there
 * is margins between its top and bottom edges and the next packs on each side
 * of the wheel equal to the current distance between each pack in a row …
 * while also having the next pack on each sides image be exactly half
 * revealed at all times". Solve it and there is one answer:
 *
 *   the middle outline spans        H/2 - P/2 - r  ..  H/2 + P/2 + r
 *   the next outline starts G later H/2 + P/2 + r + G
 *   its image starts r after that   H/2 + P/2 + 2r + G
 *   half of that image is revealed, so the viewport's foot cuts it at its
 *   own middle:  H = H/2 + P/2 + 2r + G + P/2
 *
 *   =>  P = H/2 - 2r - G     and     pitch = P + 2r + G = H/2 exactly.
 *
 * THE PITCH IS HALF THE SCREEN. That is the whole geometry in one line, and
 * it is why the halves come out at 50.0% at every size rather than at some
 * size: a pack half a screen away has exactly half of itself inside the
 * screen. Measured at 1920x947, 1440x820, 1280x720 and 390x844: 50.0% every
 * time.
 *
 * r is the pack's rule, drawn outside the image so it counts toward the gap.
 *
 * G STARTED AS THE GRID'S OWN 35 — "the current distance between each pack in
 * a row" — and is no longer, because the three controls stand in that gap:
 * see WHEEL_MARGIN just below. The pitch is untouched by that change, being
 * half the screen whatever G is; what gives is the pack.
 */

/**
 * ONE MARGIN, EVERYWHERE (the owner's 2026-09-21 "scale the packs down to
 * match the original margin constraints between them while keeping the
 * buttons equidistant").
 *
 * The three controls stand in the gap under the pack, so the gap is not just
 * pack-to-pack any more: it is margin, buttons, margin. Held at the drawing's
 * own 35 the buttons had 5.95px of air either side, which is not a margin —
 * it is what was left over. So the MARGIN is the constant now and the GAP
 * falls out of it, and the packs take the difference, because the pitch is
 * fixed at half the screen by the half-revealed rule and cannot give.
 *
 * The buttons stay equidistant by construction: one margin above them, one
 * below, so they are still centred between one pack and the next.
 */
export const WHEEL_MARGIN = GRID_GUTTER;

/** Pack to pack: a margin, the row of controls, a margin. */
export function wheelGap(button: number): number {
  return WHEEL_MARGIN * 2 + button;
}

/** The image's height, and the pitch, for a viewport of this height. */
export function wheelScale(viewportH: number, button: number) {
  const pitch = viewportH / 2;
  const image = Math.max(40, pitch - 2 * PACK_RULE - wheelGap(button));
  return { pitch, image, outline: image + 2 * PACK_RULE };
}

/**
 * Where each pack sits on the wheel, and how long one lap is.
 *
 * SIMPLER THAN THE ROW'S, and for a real reason: horizontally a pack's own
 * extent is its WIDTH, which runs 40..108 across the catalogue, so the row
 * has to carry an array of positions. Vertically the extent is the HEIGHT,
 * and every pack is drawn the same height — so the pitch is one number and
 * the position is a multiplication. Half of `cigLayout`'s reason to exist
 * disappears when the axis turns.
 */
export function wheelLayout(count: number, pitch: number) {
  return { pitch, total: count * pitch };
}

/**
 * HOW MANY COPIES OF THE SHELF THE WHEEL TURNS THROUGH.
 *
 * The loop is modular: the offset is taken modulo one lap and enough laps are
 * drawn to cover the screen. That is exact for the catalogue's 247 packs and
 * it stays exact here — but a shelf can hold two packs, and a lap shorter
 * than the screen puts the SAME pack at the top and the bottom at once. So
 * the list is repeated until one lap is longer than the screen plus a pitch,
 * which is the least that guarantees no pack is on screen twice.
 *
 * A shelf of one is the exception the arithmetic cannot save: repeated, it is
 * still the same pack above and below. That is honest — there is only one —
 * and it is what a wheel of one thing looks like.
 */
export function wheelCopies(count: number, pitch: number, viewportH: number): number {
  if (count < 1) return 1;
  const need = viewportH + pitch;
  return Math.max(1, Math.ceil(need / (count * pitch)) + 1);
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

/**
 * WHERE THE CONTROLS STAND.
 *
 * The owner: the three buttons "equidistant vertically between the selected
 * pack and the pack half appeared on the bottom", and the number square "on
 * the right of the selected pack … with an equal margin between its left edge
 * and the pack outline to the top edge of the grouping of the other 3 buttons
 * and the bottom edge of the pack outline".
 *
 * ONE NUMBER DOES BOTH, and it is `WHEEL_MARGIN`: the three stand one margin
 * under the pack and one margin above the next, which is what keeps them
 * equidistant, and the number square stands that same margin off the pack's
 * right edge.
 *
 * ONE ROW OF THREE, NOT THE LANDING PAGE'S TRIANGLE. Its glass and dots share
 * an upper line with the plus centred below, about 100px from top to bottom,
 * and two lines of these squares would not fit. The owner chose the row.
 */
export type WheelPack = CigPack;
