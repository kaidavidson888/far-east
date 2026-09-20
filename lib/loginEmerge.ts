/**
 * THE RECTANGLE COMES OUT OF THE SEAL, IT DOES NOT FADE IN.
 *
 * The owner's 2026-09-20 ask: "instead of having the rectangle appear please
 * have the black of the original seal logo flow into the black outline in the
 * login box as well as the red into the outline as well. in general
 * incorperate the rectangle's emergence more organically into the animation".
 *
 * THE SOURCE ANIMATION ALREADY DOES THIS, and measuring it is what this is
 * built on. Over frames 0..30 the 遠東 seal — a red panel with a black mountain,
 * a black cloud and the two black characters — drains away, and a BLACK BOX
 * OUTLINE forms in its place: measured, the seal's own black is 6002 px at f20,
 * 115 at f29 and exactly 0 at f30, and at f30 all 2532 black pixels left inside
 * that square lie within 6px of its border. The black of the logo flows into a
 * black outline; that is the drawing's own event. The outline then fades
 * (2532 at f30, 447 at f50, 123 at f52) while the red panel recedes, and a RED
 * outline rises in its place as the whole cloud field reddens (the square's red
 * runs 8173 px at f56 down to 4428 at f100, of which ~3112 is the outline).
 *
 * So the rectangle is not a new thing arriving over the top of that. It IS
 * that box, carried on:
 *
 *   p 0.28..0.34  THE HANDOVER. boxfill.webp erases the baked square, and this
 *                 draws the identical square in its place — same paper, same
 *                 black edge, same pixels — so nothing is seen to happen.
 *   p 0.34..0.52  THE TRAVEL. The paper and its black edge move from the
 *                 square's footprint to the rectangle's: the top and bottom
 *                 come in, the sides run out, and the edge thins from the
 *                 square's 4px to the row's 2px as it goes. Ink runs ahead of
 *                 each side and curls back — the seal's own filigree, the same
 *                 generator the landing menu grows by — so it reads as the
 *                 outline being drawn rather than a rectangle being scaled.
 *   p 0.52..0.88  THE RED. The outer rule fills outward from the middle of
 *                 each side, which is where the seal's red still is, in step
 *                 with the field's own reddening.
 *
 * It is drawn on the splash canvas, after the vignette, because the login row
 * is a DOM layer above the canvas and is not washed by it — drawing the
 * emergence under the wash would make the handover a change of contrast.
 */

import {
  mulberry32, spline, channel as rawChannel, sprout, easeInOut, smoothstep,
} from '@/scripts/lib/ink-growth.mjs';
import { LOGIN_BOX } from './loginBox';

type Pt = { x: number; y: number };
type Channel = {
  pts: Pt[]; cum: Float64Array; len: number; w0: number; w1: number;
  t0: number; dur: number;
};
const channel = rawChannel as (spec: {
  pts: Pt[]; w0: number; w1: number; t0?: number; speed?: number; depth?: number;
}) => Channel;

export type Rect = { x: number; y: number; w: number; h: number };

/** The run, in fractions of the splash's own four seconds. */
export const EMERGE = {
  /** the baked square is erased and ours takes its place, invisibly */
  handFrom: 0.28,
  handTo: 0.34,
  /** the paper and its black edge travel to the rectangle's footprint */
  travelFrom: 0.34,
  travelTo: 0.52,
  /** the outer rule fills, in step with the field's own reddening */
  redFrom: 0.52,
  redTo: 0.88,
} as const;

/** The paper this site is drawn on, and the artwork's own red. */
const PAPER = '#fcfcfc';
const RED = '#ff0000';
const BLACK = '#010101';
/** The baked square's own black edge, measured off the frames at f30. */
const SQUARE_RULE = 4;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / Math.max(1e-6, b - a));

/**
 * The filigree that runs ahead of each side as it travels.
 *
 * One little network per side, grown OUTWARD from where that side starts and
 * along the way it goes, so the ink is always in front of the edge it belongs
 * to. Seeded, so the same picture every time; small, because it is a flourish
 * on a moving line and not the subject.
 */
function sideInk(seed: number, len: number, wide: boolean, band: number): Channel[] {
  const rng = mulberry32(seed);
  const wob = (a: number) => a * (rng() * 2 - 1);
  const n = Math.max(3, Math.round(len / 26));
  const way: Pt[] = [{ x: 0, y: 0 }];
  for (let i = 1; i <= n; i += 1) {
    const u = i / n;
    way.push({ x: u * len, y: Math.sin(u * 4.3 + 0.6) * 2.4 + wob(1.4) });
  }
  /*
   * THE TRUNK IS THIN. It lies along an edge that is already being drawn as a
   * rule, so a heavy one doubles that rule and the travelling box reads as
   * clumsy rather than as ink; the CURLS are what say this is ink, not the
   * line under them.
   */
  const trunk = channel({ pts: spline(way, 0.5), w0: wide ? 1.4 : 1.2, w1: 0.6, t0: 0, speed: 1 });
  trunk.dur = 1;
  const out: Channel[] = [trunk];
  sprout(trunk, {
    step: 0.5,
    start0: 0.08,
    gap0: 20,
    gap1: 9,
    angle: 0.5,
    lens: [13, 8, 5],
    minLen: 3,
    maxDepth: 2,
    bypass: 0.22,
    bypassLen: 14,
    bow: 3,
    twig: 0.5,
    twigLen: 8,
    curl: 2.6,
    fork: 0.4,
    speed: 240,
    bias: 0.5,
    inside: (x: number, y: number) => x > -2 && x < len + 14 && y > -band && y < band,
  }, rng, out);
  /*
   * THE NETWORK IS PUT ON ONE CLOCK, and that is not a nicety. A child is
   * placed at its own arc along its parent, so drawing every channel to the
   * same FRACTION of its own length puts a stub two hundred pixels ahead of a
   * trunk that has travelled twenty — which came out as two dashed lines
   * running off both sides of the box, measured at travel 0.2. Each channel
   * has a birth time and a duration; the front is read off those.
   */
  const end = Math.max(...out.map((c) => c.t0 + c.dur));
  if (end > 0) for (const c of out) { c.t0 /= end; c.dur /= end; }
  return out;
}

/** One channel, up to arc `to`, in the caller's own transform. */
function stroke(ctx: CanvasRenderingContext2D, c: Channel, to: number) {
  if (to <= 0) return;
  const { pts, cum, len, w0, w1 } = c;
  for (let i = 1; i < pts.length; i += 1) {
    if (cum[i - 1] >= to) break;
    const a = pts[i - 1];
    let b = pts[i];
    if (cum[i] > to) {
      const k = (to - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      b = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    const hw = w0 + (w1 - w0) * Math.min(1, cum[i - 1] / Math.max(1e-6, len));
    if (hw <= 0.05) continue;
    ctx.lineWidth = hw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

export type LoginEmerge = {
  /** true once the rectangle is entirely the row's own, and the DOM may take it */
  done: (p: number) => boolean;
  draw: (ctx: CanvasRenderingContext2D, p: number, square: Rect, rect: Rect) => void;
};

/**
 * Build the emergence. Nothing here depends on where the square or the
 * rectangle are — they are handed in per frame, so a resize needs no rebuild —
 * except the filigree, whose length follows the travel and is regrown when
 * the rectangle's own width changes.
 */
export function loginEmerge(): LoginEmerge {
  let ink: { key: string; sides: Channel[][] } | null = null;
  const inkFor = (rect: Rect, square: Rect) => {
    const key = `${Math.round(rect.w)}x${Math.round(square.w)}`;
    if (ink && ink.key === key) return ink.sides;
    // one per side: top and bottom run the rectangle's own length, the two
    // ends travel only as far as the square's edge has to move
    const run = rect.w / 2;
    const ends = Math.max(10, (rect.w - square.w) / 2);
    ink = {
      key,
      sides: [
        sideInk(20260921, run, true, 17),
        sideInk(20260922, run, true, 17),
        sideInk(20260923, ends, false, LOGIN_BOX.h / 2 - 3),
        sideInk(20260924, ends, false, LOGIN_BOX.h / 2 - 3),
      ],
    };
    return ink.sides;
  };

  const draw = (ctx: CanvasRenderingContext2D, p: number, square: Rect, rect: Rect) => {
    const hand = ramp(p, EMERGE.handFrom, EMERGE.handTo);
    if (hand <= 0) return;
    const travel = easeInOut(ramp(p, EMERGE.travelFrom, EMERGE.travelTo));
    const red = ramp(p, EMERGE.redFrom, EMERGE.redTo);

    /*
     * THE BOX ON ITS WAY. At travel 0 it is the square the frames drew, to the
     * pixel; at 1 it is the row's rectangle. The black edge thins from the
     * square's measured 4px to the row's 2px and moves from the box's own edge
     * to the 5px inset the red rule will leave it, so the outline the seal
     * drained into is the outline the row keeps.
     */
    const x = lerp(square.x, rect.x, travel);
    const y = lerp(square.y, rect.y, travel);
    const w = lerp(square.w, rect.w, travel);
    const h = lerp(square.h, rect.h, travel);
    const rule = lerp(SQUARE_RULE, LOGIN_BOX.inner, travel);
    const inset = lerp(0, LOGIN_BOX.rule, travel);

    ctx.save();
    ctx.globalAlpha = hand;

    // the paper, which is the box's own white knocked out of the cloud field
    ctx.fillStyle = PAPER;
    ctx.fillRect(x, y, w, h);

    /*
     * THE RED RULE, filling OUTWARD FROM THE MIDDLE OF EACH SIDE — which is
     * where the seal's red still is at that point in the run, so the colour
     * leaves the middle of the picture and arrives at the edge of the box.
     * It is drawn under the black, at the rectangle's own outermost 5px.
     */
    if (red > 0) {
      const g = easeInOut(red);
      ctx.fillStyle = RED;
      const R = LOGIN_BOX.rule * travel;
      const hw = (w / 2) * g;
      const hh = (h / 2) * g;
      const cx = x + w / 2;
      const cy = y + h / 2;
      // top and bottom, growing from the middle out to the corners
      ctx.fillRect(cx - hw, y, hw * 2, R);
      ctx.fillRect(cx - hw, y + h - R, hw * 2, R);
      // the two ends, which only start once their corner has been reached
      const side = clamp01((g - 0.62) / 0.38);
      const sh = (h / 2) * easeInOut(side);
      ctx.fillRect(x, cy - sh, R, sh * 2);
      ctx.fillRect(x + w - R, cy - sh, R, sh * 2);
    }

    // the black edge the seal drained into, carried onto the new footprint
    ctx.strokeStyle = BLACK;
    ctx.lineWidth = rule;
    ctx.strokeRect(x + inset + rule / 2, y + inset + rule / 2, w - 2 * (inset + rule / 2), h - 2 * (inset + rule / 2));

    /*
     * INK RUNS AHEAD OF EACH SIDE AS IT TRAVELS and curls back on itself, so
     * the outline reads as being drawn rather than as a rectangle being
     * scaled. It is grown while the side is moving and gone by the time it
     * stops, which is why the resting picture is a clean rectangle.
     */
    const lead = smoothstep(0, 0.34, travel) * (1 - smoothstep(0.72, 1, travel));
    if (lead > 0.01) {
      const sides = inkFor(rect, square);
      const run = easeInOut(Math.min(1, travel / 0.86));
      ctx.globalAlpha = hand * lead;
      ctx.strokeStyle = BLACK;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      /*
       * EVERY RUN GOES THE WAY ITS EDGE IS GOING. The top and bottom are
       * being drawn outward from the middle, so their ink runs along them
       * both ways; the two ends are travelling SIDEWAYS, out to where the
       * rectangle's corners will be, so theirs runs horizontally out in front
       * of them. Rotating the ends' ink to run down the side instead sent two
       * strokes 143px up and down out of an 87px box, which is what the first
       * cut of this did.
       */
      const place = [
        { x: x + w / 2, y: y + inset + rule / 2, a: 0, set: 0 },
        { x: x + w / 2, y: y + inset + rule / 2, a: Math.PI, set: 1 },
        { x: x + w / 2, y: y + h - inset - rule / 2, a: 0, set: 1 },
        { x: x + w / 2, y: y + h - inset - rule / 2, a: Math.PI, set: 0 },
        { x: x + inset + rule / 2, y: y + h / 2, a: Math.PI, set: 2 },
        { x: x + w - inset - rule / 2, y: y + h / 2, a: 0, set: 3 },
      ];
      for (const at of place) {
        ctx.save();
        ctx.translate(at.x, at.y);
        ctx.rotate(at.a);
        for (const c of sides[at.set]) stroke(ctx, c, ((run - c.t0) / c.dur) * c.len);
        ctx.restore();
      }
    }

    ctx.restore();
  };

  return { done: (p: number) => p >= EMERGE.redTo, draw };
}
