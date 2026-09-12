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
 * Everything that moves the row runs at this share of what it used to.
 *
 * It was 0.8 for a while — the owner asked for the scroll a fifth slower —
 * and then asked for that taken back off, so it is 1 again and the row runs
 * at the speed the source recording does. It still scales only what a wheel
 * notch is worth and how far a flick carries; the drag has always been pinned
 * 1:1 to the pointer, because a drag that lagged the finger would not read as
 * slower, it would read as broken.
 */
export const SPEED = 1;

/**
 * How much longer the red frame stays on a pack after another one has taken
 * the middle of the row.
 *
 * Without it the frame belongs to whichever pack is nearest the centre at that
 * instant, so it changes hands the moment two packs cross — several times a
 * second on a flick, and twice in quick succession every time the row settles
 * past a boundary and back. A pack keeps the frame until another has been
 * nearest for this long WITHOUT INTERRUPTION, so one that takes the middle and
 * loses it again inside the window never gets the frame at all.
 *
 * TWO FRAMES, AND THE NUMBER IS MEASURED. Sampling which pack was nearest the
 * middle through a gentle, a firm and a hard flick, how long each one held it
 * falls into three groups:
 *
 *   126-146ms   packs flying past mid-glide — the flicker
 *   256-385ms   the last one or two as the row slows
 *   512-767ms   the pack it finally settles on
 *
 * So the window that kills the first group and keeps the second is 150 to
 * 250ms. It cannot be finer than that anyway: the row paints on a 125ms beat,
 * so the hold expires on a tick boundary whatever it is set to, and anything
 * from 126 to 250 behaves identically — it lands on the second tick.
 *
 * Hence two frames. 500ms was the first attempt and was too sticky: it
 * suppressed the 256-385ms group as well, which are real changes, and left the
 * frame riding a pack most of the way to the edge before handing over.
 *
 * The frame travels with the pack it is holding, so through those two frames it
 * slides off the centre rather than sitting still. That is the point: it stays
 * ON THE IMAGE, and the image is moving.
 */
export const CIG_FRAME_HOLD_MS = PAINT_MS * 2;

/**
 * How hard the row is braked once it is let go, in pixels per second squared.
 *
 * IT DECELERATES AT A CONSTANT RATE, which is what friction does. The glide
 * used to decay exponentially — v *= exp(-dt/tau) — and that is viscous drag,
 * the physics of something moving through a fluid: the braking force falls
 * away with the speed, so the row never quite stops, it only gets slower and
 * slower until a threshold gives up on it. It is why naive momentum scrolling
 * feels floaty.
 *
 * Something sliding on a surface is braked by a force that does not care how
 * fast it is going, so it sheds speed at a steady rate and comes to a real
 * stop at a definite moment. Two consequences you can feel:
 *
 *   stopping distance   v^2 / 2a   quadratic, not linear. Throw it twice as
 *                                  hard and it goes four times as far, which
 *                                  is what the hand expects.
 *   stopping time       v / a      finite. The row stops rather than fades.
 *
 * IT IS SET FOR A ROULETTE WHEEL, which is a heavy mass on low-friction
 * bearings: it flies at first, winds down over seconds, and creeps into its
 * slot rather than snapping to it. 600 against a cap of ten times the
 * reference pace gives a hard throw 3.2 seconds and about 31 packs of travel —
 * long enough to watch it wind down and wonder where it will stop.
 *
 * Constant braking is the right shape for that quite apart from being what
 * friction does: speed falls linearly, so the PROPORTION lost each second
 * grows, and the last half second is where the winding-down reads. An
 * exponential decay does the opposite — it sheds most of its speed at the
 * start and then crawls, which is the floaty tail this replaced.
 *
 * Divided by SPEED rather than multiplied: SPEED is how far a flick carries,
 * and less braking carries further.
 */
export const CIG_GLIDE_FRICTION = 600 / SPEED;

/**
 * The fastest the row may be let go at, in pixels per second.
 *
 * WITHOUT THIS THERE IS EFFECTIVELY NO FRICTION, whatever the braking is set
 * to. A drag used to take its parting speed from the last pointer move alone —
 * one sample, whatever it happened to be — and a move of 40px in 8ms is
 * 5000px/s, which even at a firm brake glides for thousands of pixels and
 * several seconds. The row did not feel unbraked because the braking was too
 * gentle; it felt unbraked because it was being thrown impossibly hard.
 *
 * Ten times the pace of the owner's own recording: fast enough to read as a
 * wheel being spun rather than a row being nudged, and still slow enough that
 * the packs are packs and not a smear. It is the same shape of limit the wheel
 * already had, which is now written as half of this.
 */
export const CIG_FLING_MAX = REFERENCE_SPEED * 10;

/**
 * How far back a release looks to decide how fast it was going.
 *
 * One sample is the instantaneous speed between two moves, which is mostly
 * noise: pointer events do not arrive evenly, and a single 4ms gap doubles the
 * answer. Averaging over the tail of the gesture is what every real fling
 * does, and it is also the more honest measurement — the speed of a throw is
 * the speed of the hand over the throw, not over its last millisecond.
 */
export const CIG_FLING_WINDOW_MS = 80;

