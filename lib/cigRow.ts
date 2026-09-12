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
 * The SVG's outline is 74x104 around a 58x90 pack — 8 either side, 7 above
 * and below. The owner asked for it equidistant on every side, taking the
 * sides as the model, so it is 8 all round. The packs here are all one
 * height but their own widths, from 42 to 92, so a fixed width would cut
 * into the broad ones: the margin is the part that is really fixed, and the
 * frame takes its width from the pack it is holding.
 */
export const CIG_OUTLINE = { x: 8, y: 8, stroke: 5, colour: '#ff0000' };

/** The frame's outer box, vertically. 92 + 8 + 8 = 108. */
export const CIG_FRAME_H = CIG_HEIGHT + CIG_OUTLINE.y * 2;

/**
 * The two rules that appear above and below when the row has the keyboard.
 *
 * They started life as the focus ring — the row runs the full width of the
 * page, so its outline only ever showed as a line top and bottom. The owner
 * liked that and asked for it kept, in the frame's own weight and colour,
 * and pushed out so that the clearance they had from the packs is now the
 * clearance they have from the frame.
 */
export const CIG_RULE = { thickness: CIG_OUTLINE.stroke, gap: 9 };

/** The row's own height: the frame, plus room for a rule either side. */
export const CIG_BAND_H = CIG_FRAME_H + (CIG_RULE.gap + CIG_RULE.thickness) * 2;

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

/**
 * How long the frame takes to catch up with the pack it has picked.
 *
 * The row itself steps at 8fps and the frame used to step with it, landing on
 * the new pack in the same instant the packs moved. The owner asked for it to
 * drag: it now runs behind, easing out, so it is still arriving when the row
 * has already gone. Two of the row's own 125ms steps, which is enough to read
 * as weight without the frame ever being a pack behind.
 *
 * It is the one thing on this row that is not stepped. That is deliberate —
 * the stepping is the packs' character, and a frame that glides against it is
 * what makes the drag visible at all.
 */
export const CIG_FRAME_DRAG_MS = PAINT_MS * 2;

/**
 * Everything that moves the row runs at this share of what it used to.
 *
 * The owner asked for the scroll a fifth slower without losing the sense of
 * it being under your hand, so this scales what a wheel notch is worth and
 * how far a flick carries — but never the drag itself, which stays pinned
 * 1:1 to the pointer. A drag that lagged the finger by 20% would not read as
 * slower, it would read as broken.
 */
export const SPEED = 0.8;
