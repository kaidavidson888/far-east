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
 * MEASURED OFF THE OWNER'S OWN REFERENCE WHEEL. The gif they supplied is 185
 * frames of a twelve-segment prize wheel coming to rest over 11.9 seconds.
 * Cross-correlating a ring of pixels between consecutive frames gives the
 * angle it turned through each time, so the whole speed curve comes out of it
 * without anyone having to judge it by eye:
 *
 *     t      deg/s    px/s     rate over that leg
 *     0s      425     1360
 *   1.4s      383     1226      96 px/s^2
 *   3.6s      303      970     116
 *   6.8s      234      749      69
 *   9.6s       89      285     166
 *  11.4s       21       67      46
 *  11.9s        0        0     134
 *
 * A segment of that wheel is 30 degrees and a pack of this row is about 96px,
 * so one degree is 3.2px and the two are directly comparable: a segment
 * passing the pointer is a pack passing the frame.
 *
 * IT IS ONE CONSTANT RATE. The legs above scatter between 46 and 166 with no
 * drift up or down, and fitting a single rate to the whole spin — 1360px/s
 * brought to rest in 11.9s — gives 114. So the wheel is not braking harder as
 * it slows, which is what the previous version of this file assumed and built
 * a two-rate curve around. It was wrong, and the curve is gone.
 *
 * The last second of the reference, which is what the owner pointed at, is
 * this same rate: about 100px/s down to nothing, roughly a pack a second,
 * each one visibly ticking past.
 *
 * Dividing by SPEED rather than multiplying: SPEED is how far a flick carries,
 * and less braking carries further.
 */
export const CIG_BRAKE = 115 / SPEED;

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
 * TWICE the pace of the owner's own recording, where it was eight times. At
 * eight the row was a smear at the top of a throw and the spin ran thirteen
 * seconds; the owner asked for a quarter of the speed, and this is that. The
 * braking is untouched at the reference wheel's own rate, so what goes is the
 * length of the spin, not its character:
 *
 *   top speed   1517px/s  ->  379px/s
 *   spin             13s  ->  3.3s
 *   travel     104 packs  ->  7 packs
 *
 * It is the same shape of limit the wheel already had, which is written as
 * half of this.
 *
 * NOTE that this caps the RELEASE only. A drag still moves the row pixel for
 * pixel under the finger however fast the hand goes — a drag that lagged
 * would not read as slower, it would read as broken. What is capped is what
 * the row is left with when the finger lifts.
 */
export const CIG_FLING_MAX = REFERENCE_SPEED * 2;

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

/* ------------------------------------------------ the My Saved spin ------
 * Pressing My Saved spins the row like a roulette wheel, swaps the packs for
 * the reader's own shelf while it is going too fast to read, and lets the
 * ordinary physics bring it to rest. Three numbers below, and one of them
 * bends a rule elsewhere in this file on purpose — see CIG_SPIN_PAINT_MS.
 */

/**
 * How fast the row is spun, in pixels per second.
 *
 * One lap of the catalogue is 20,580px (247 packs at their own widths plus
 * the 26px gap), and the swap happens after exactly one lap, so this number
 * IS the length of the spin:
 *
 *   3,000px/s    6.9s     too long to hold anyone
 *  10,290px/s    2.0s     this
 *  20,580px/s    1.0s     over before it reads as a spin
 *
 * Two seconds is long enough to register as a wheel being thrown and short
 * enough that nobody is waiting. It is 54x the pace the owner's recording
 * runs at, which is the point: at this speed the packs are a smear, and a
 * smear is what makes the swap invisible. Nothing is hidden by a cut here —
 * the row genuinely never stops.
 */
export const CIG_SPIN_SPEED = 10290;

/**
 * One lap: the distance the row travels before the packs are swapped.
 *
 * Derived, not typed in — `cigLayout()` already totals the row, so a pack
 * added to or dropped from `cigs.json` moves this with it. "After one cycle"
 * means one cycle of the whole catalogue, so it is the full lap rather than a
 * screenful.
 */
export const CIG_SPIN_LAP = cigLayout().total;

/**
 * How often the row repaints WHILE IT IS SPINNING, in milliseconds.
 *
 * THIS IS THE ONE PLACE THE 8FPS RULE IS SET ASIDE, and it is worth saying
 * why rather than discovering it later. The row paints every 125ms because
 * the owner's reference MP4 runs at 8fps and that stepping is the design. But
 * that recording is of the gentle idle scroll, and 8fps describes it honestly.
 * At spin speed one 125ms frame covers 1,286px — about fifteen packs — so
 * consecutive frames share nothing, and the row reads as static noise rather
 * than as something turning. That is not the owner's stepping, it is aliasing.
 *
 * 25ms (40fps) puts a frame every 257px, which still smears but smears
 * CONTINUOUSLY, which is what a wheel at speed looks like. The instant the
 * spin hands back to the ordinary physics the row is back on PAINT_MS, so
 * every motion the reference actually measured is untouched.
 *
 * Set this to PAINT_MS to put the spin back on 8fps and see the difference.
 */
export const CIG_SPIN_PAINT_MS = 25;

/**
 * How often the row repaints at a given speed.
 *
 * The spin used to switch between 25ms and 125ms on a flag, and the switch
 * itself was visible: the moment the packs were swapped the row went from 40
 * frames a second to 8, which reads as a stumble exactly where the animation
 * is meant to be handing over smoothly. A rate that follows the SPEED has no
 * such moment — it is already at 125ms by the time the row is going slowly
 * enough for 125ms to be the right answer.
 *
 * BELOW A NORMAL THROW IT IS EXACTLY PAINT_MS, so the owner's 8fps is intact
 * for every motion the reference recording actually measured — a drag, a
 * wheel, a fling, the settle. Only the spin ever exceeds CIG_FLING_MAX, and
 * only the spin is ever painted faster:
 *
 *   10,290px/s  (the throw)      25ms   clamped
 *    2,000px/s                   24ms -> 25ms
 *      758px/s  (2x a throw)     62ms
 *      379px/s  (a hard throw)  125ms   and everything slower
 */
export function cigPaintMs(speed: number): number {
  const over = Math.abs(speed) / CIG_FLING_MAX;
  if (over <= 1) return PAINT_MS;
  return Math.max(CIG_SPIN_PAINT_MS, PAINT_MS / over);
}

/**
 * How hard the wheel is caught after the packs have been swapped, in pixels
 * per second squared.
 *
 * The velocity used to be ASSIGNED back down to CIG_FLING_MAX in one frame —
 * 10,290px/s to 379px/s between one paint and the next. That is a 27-fold
 * drop with nothing in between, and it looked like one: the row appeared to
 * snag rather than to slow. The owner called it jitteriness, which is fair.
 *
 * So the drop is spread over CATCH_MS instead, at one constant rate, and the
 * row is genuinely decelerating the whole way. It is still "the momentum
 * returns to the normal amount" — it just takes 400ms to get there rather
 * than happening between two frames, and 400ms is about as long as a hand
 * closing on a spinning wheel takes.
 *
 * The ordinary CIG_BRAKE could not do this job: at 115px/s^2 it would need
 * 86 seconds to bring the spin down.
 */
const CATCH_MS = 400;
export const CIG_SPIN_CATCH = ((CIG_SPIN_SPEED - CIG_FLING_MAX) / CATCH_MS) * 1000;

