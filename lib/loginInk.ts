/**
 * THE ROW'S WORD IS WRITTEN BY TENDRILS OUT OF THE BLACK OUTLINE, AND THEY ARE
 * GENERATED IN THE BROWSER — there are no baked frames here.
 *
 * The owner's 2026-09-20 ask: "have the ink of the Phone # text grow back into
 * a second rectangle outline on the inner edge of the red one this one in
 * black. Use the tendril animation to regrow the black outline into the new
 * text for the row. Use this same animation with each new text."
 *
 * It is the landing menu's machinery (scripts/lib/ink-growth.mjs) pointed at
 * one word at a time, with two differences, and both of them are why nothing
 * is baked:
 *
 *   - THE WORDS ARE TYPE, NOT A DRAWING. The mountain's words were cut out of
 *     the owner's gif, so they could only be measured by a build. These are
 *     set in the owner's own face, which the browser already has, so a word
 *     can be rastered where it is shown and at the size it is shown at.
 *   - THERE ARE FIVE OF THEM AND A READER SEES AT MOST FOUR. Baking five
 *     networks at the mountain's density would be several MB on the first page
 *     of the site, for an animation most readers watch once.
 *
 * So the network is grown from a seeded PRNG when the word is first asked for
 * (a few ms) and stroked with the canvas's own round-capped lines rather than
 * through `Ink`'s coverage buffer: at this size that is the same picture, and
 * it is the difference between a frame costing a tenth of a millisecond and
 * costing eighty.
 *
 * TWO PHASES, THE DOTS MENU'S. 0..GROW the tendrils leave the outline and
 * write the word; GROW..1 they withdraw back into it and the word stays. So
 * the run's last frame is the resting state — the word alone — and taking a
 * word away is the same run backwards: the tendrils reach back out, gather it
 * up and carry it home. One network, both directions, exactly as the menus do.
 */

import {
  mulberry32, spline, channel as rawChannel, atArc, sprout, linkTips, vn2, smoothstep, easeInOut,
} from '@/scripts/lib/ink-growth.mjs';
import { LOGIN_ROW, LOGIN_TYPE, fitRow } from './loginBox';
import INK from '@/scripts/assets/far-east-ink.json';

type Pt = { x: number; y: number };
type Channel = {
  pts: Pt[]; cum: Float64Array; len: number; w0: number; w1: number;
  t0: number; dur: number; id: string | null;
};
/*
 * ink-growth.mjs is plain JS and TypeScript reads its parameter types off the
 * destructuring defaults, so `id = null` makes `id` a `null`. One named cast
 * here rather than a cast at every call.
 */
const channel = rawChannel as (spec: {
  pts: Pt[]; w0: number; w1: number; t0?: number; speed?: number; depth?: number; id?: string;
}) => Channel;

/** The face's own per-character ink extents, measured in Chrome at 1000 upem. */
const asc = (c: string) => (INK.asc as Record<string, number>)[c] ?? 700;
const desc = (c: string) => (INK.desc as Record<string, number>)[c] ?? 0;
const adv = (c: string) => (INK.adv as Record<string, number>)[c] ?? 700;

/**
 * A WORD IS SET AS TALL AS THE VERTICAL RULE BESIDE IT (the owner's 2026-09-20
 * "make the size of the typed characters the same height as the altered
 * vertical dashed line"), shrunk if it is too long for the line it stands on.
 *
 * The rule the shelf and the cigarette pages already set type by: a drawing
 * has no point size to copy, so what is matched is the INK. `fitRow` in
 * lib/loginBox.ts is the one copy of it, shared with what the reader types —
 * the prompt and the answer sit in the same place on the same baseline, so
 * they have to be sized by the same arithmetic or the one would jump as it
 * became the other.
 */
export function wordInk(word: string) {
  return fitRow(word, INK as { asc: Record<string, number>; desc: Record<string, number>; adv: Record<string, number>; em: number });
}

export type LoginInk = {
  /** the canvas, in row px */
  view: { w: number; h: number };
  /** 0..grow writes the word; grow..1 withdraws the growth and leaves it */
  grow: number;
  /** how long the whole run takes, forward */
  ms: number;
  draw: (ctx: CanvasRenderingContext2D, t: number, ss: number) => void;
};

/**
 * How far along its own run a letter takes to come up, as a fraction of the
 * word’s own ink height. It has to be a fraction: this row sets a word
 * anywhere from 58px of ink down to about 29, and six fixed pixels of soak is
 * a wet edge on the one and a hard wipe on the other.
 */
const SOAK_OF = 0.12;
/**
 * HOW FAR OFF THE CHANNEL COUNTS AS DISTANCE ALONG IT. The mountain menu uses
 * 0.9 with words a fifth this size; here half the word is 26px from the trunk,
 * and at 0.9 that is 23px of arc added to the far pixels — which is what left
 * the first cut of this row showing a horizontal BAND of each letter and
 * nothing else, the pixels near the trunk having arrived and the rest never
 * being reached at all.
 */
const OFF_ARC = 0.45;
const GROWTH = {
  step: 0.5,
  start0: 0.05,
  gap0: 12,
  gap1: 5,
  angle: 0.45,
  lens: [18, 11, 6],
  minLen: 3,
  maxDepth: 3,
  bypass: 0.26,
  bypassLen: 16,
  bow: 3.4,
  twig: 0.44,
  twigLen: 9,
  curl: 2.8,
  fork: 0.45,
  speed: 240,
};
/** The tendrils' share of the run, and what is left for them to withdraw in. */
const GROW = 0.74;
/** No channel may empty in less than this share of the withdrawal. */
const PULL_MIN = 0.15;
/** How long one word takes to arrive, forward. Reverse is twice that pace. */
const RUN_MS = 1800;

/**
 * Grow one word's network.
 *
 * `view` is the canvas the row gives it — the whole inside of the black
 * outline — and `at` is where the word's ink is to land in it. The trunk leaves
 * the outline's left edge on the word's own middle line and runs past the end
 * of the word, so every letter is written by ink going by it rather than by a
 * wipe; children are spawned at gaps that shorten with distance, so the network
 * thickens outward, which is the owner's "sprouts more connected paths as it
 * flows outward".
 */
export function buildLoginInk(
  word: string,
  view: { w: number; h: number },
  /** the canvas's own top-left inside the rectangle, so box px become canvas px */
  origin: { x: number; y: number },
  seed: number,
): LoginInk {
  const ink = wordInk(word);
  const soak = ink.h * SOAK_OF;
  // where this word's ink lands in the canvas: it hangs from the row's fixed
  // baseline, so a word shrunk to fit the line sits ON the line with the
  // others rather than floating to its own centre
  const at = { x: LOGIN_ROW.textX - origin.x, y: ink.top - origin.y };
  const baseline = LOGIN_TYPE.baseline - origin.y;
  const mid = at.y + ink.h / 2;
  const rng = mulberry32(seed);
  const wob = (a: number) => a * (rng() * 2 - 1);

  /*
   * THE TRUNK RUNS THROUGH THE MIDDLE OF THE WORD, which it can because the
   * word is now as tall as the rule beside it. The mountain's menu does the
   * same and it is what makes the growth WRITE rather than cross out: the
   * glyph mask thins the stroke to nothing over a letter, so the ink threads
   * between the letterforms and through their counters. (It ran above the cap
   * line for an afternoon, when the word was ten pixels tall and any stroke
   * across it was a strike however thin — that reason has gone with the size.)
   */
  const endX = Math.min(view.w - 3, at.x + ink.w + 10);
  const way: Pt[] = [{ x: 0, y: mid }];
  const steps = Math.max(4, Math.round(endX / 22));
  for (let i = 1; i <= steps; i += 1) {
    const u = i / steps;
    way.push({ x: u * endX, y: mid + Math.sin(u * 5.1 + 0.7) * ink.h * 0.09 + wob(ink.h * 0.05) });
  }
  /*
   * THE STROKE IS A FRACTION OF THE WORD, not a fixed width. The type in this
   * row runs from 58px of ink down to about 29 when a long prompt shrinks to
   * fit, and a 1.7px tendril beside a 58px letterform reads as a hair rather
   * than as ink of the same family.
   */
  const trunk = channel({
    pts: spline(way, GROWTH.step), w0: ink.h * 0.055, w1: ink.h * 0.026, t0: 0, speed: 1, id: 'trunk',
  });
  trunk.dur = 1;
  const streams: Channel[] = [trunk];

  // the growth keeps to the row: inside the canvas, off the outline it grew
  // from. The trunk runs down the middle of the word, so there is as much room
  // above it as below and the sides need no bias.
  const band = (x: number, y: number) => x > 1 && x < view.w - 1 && y > 2 && y < view.h - 2;
  sprout(trunk, { ...GROWTH, bias: 0.5, inside: band }, rng, streams);
  streams.push(...(linkTips(streams, {
    near: 10, chance: 0.6, maxLinks: 10, align: 0.8,
    inside: band, step: GROWTH.step, speed: GROWTH.speed,
  }, rng) as Channel[]));

  const lastEnd = Math.max(...streams.map((c) => c.t0 + c.dur));
  if (lastEnd > 1) for (const c of streams) { c.t0 /= lastEnd; c.dur /= lastEnd; }
  /*
   * WHERE EACH CHANNEL IS ROOTED, as a fraction of the trunk's run. The
   * withdrawal empties the trunk from its tip back to the outline, and a child
   * has to be gone by the time the front passes the place it grew from — so it
   * is given that place and empties into it. A child of a child is born later,
   * so it goes first, which is the order wanted. Nothing may vanish in a single
   * frame, which is what a detach of 1 would mean, so PULL_MIN is the least
   * window any of them gets.
   */
  const detach = new Map<Channel, number>();
  for (const c of streams) detach.set(c, Math.min(1 - PULL_MIN, c.t0));

  /** The word, rastered once, and how far along the trunk each pixel is reached from. */
  let glyph: { a: Float32Array; T: Float32Array; w: number; h: number; ss: number; maxT: number } | null = null;
  const raster = (ss: number) => {
    if (glyph && glyph.ss === ss) return glyph;
    const w = Math.max(1, Math.round(view.w * ss));
    const h = Math.max(1, Math.round(view.h * ss));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.font = `700 ${ink.size * ss}px "Far East", sans-serif`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#000';
    g.fillText(word, at.x * ss, baseline * ss);
    const px = g.getImageData(0, 0, w, h).data;
    const a = new Float32Array(w * h);
    const T = new Float32Array(w * h);
    for (let i = 0; i < w * h; i += 1) a[i] = px[i * 4 + 3] / 255;
    /*
     * EVERY PIXEL OF THE WORD KNOWS HOW FAR ALONG THE TRUNK IT IS REACHED
     * FROM: the arc of the nearest point on the writer, plus 0.9 of how far
     * off it the pixel sits, plus two octaves of SPATIAL noise. It comes up
     * when the front has passed that distance, over SOAK px of soak. So a
     * letter grows out of the stroke going past it with a ragged wet edge —
     * and because the noise is of place and never of time, the edge cannot
     * shimmer.
     */
    const probe: { x: number; y: number; s: number }[] = [];
    for (let s = 0; s <= trunk.len; s += 2) {
      const p = atArc(trunk, s) as Pt;
      probe.push({ x: p.x, y: p.y, s });
    }
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (a[i] <= 0) continue;
        const qx = x / ss;
        const qy = y / ss;
        let best = Infinity;
        let bs = 0;
        for (const q of probe) {
          const d = (q.x - qx) * (q.x - qx) + (q.y - qy) * (q.y - qy);
          if (d < best) { best = d; bs = q.s; }
        }
        T[i] = bs + OFF_ARC * Math.sqrt(best)
          + 5 * vn2(qx / 9, qy / 9, seed) + 2.5 * vn2(qx / 3.5, qy / 3.5, seed ^ 7);
      }
    }
    let maxT = 0;
    for (let i = 0; i < w * h; i += 1) if (a[i] > 0 && T[i] > maxT) maxT = T[i];
    glyph = { a, T, w, h, ss, maxT };
    return glyph;
  };

  /** 0..1 of a glyph under a point of the row, for thinning the stroke over it. */
  const gmaskAt = (gx: number, gy: number, ss: number) => {
    const G = glyph;
    if (!G) return 0;
    const x = Math.round(gx * ss);
    const y = Math.round(gy * ss);
    if (x < 0 || y < 0 || x >= G.w || y >= G.h) return 0;
    return G.a[y * G.w + x];
  };

  /** The word's own layer, rebuilt only when the front has actually moved. */
  let plate: HTMLCanvasElement | null = null;
  let plateAt = -1;

  const draw = (ctx: CanvasRenderingContext2D, t: number, ss: number) => {
    const G = raster(ss);
    ctx.clearRect(0, 0, view.w * ss, view.h * ss);
    const u = Math.min(1, Math.max(0, t));
    const growT = Math.min(1, u / GROW);
    // how far the withdrawal has got; 0 until the apex
    const out = u <= GROW ? 0 : easeInOut((u - GROW) / (1 - GROW));

    ctx.save();
    ctx.scale(ss, ss);
    ctx.strokeStyle = '#000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const c of streams) {
      const front = ((growT - c.t0) / c.dur) * c.len;
      if (front <= 0) continue;
      let to = Math.min(c.len, front);
      if (out > 0) {
        // emptied from the tip back to where it is rooted, each channel over
        // its own window, so the family goes out in the order it came in
        const d = detach.get(c) ?? 0;
        to = Math.min(to, c.len * Math.max(0, 1 - Math.min(1, (out - d) / (1 - d))));
      }
      if (to <= 0.01) continue;
      strokeTo(ctx, c, to, gmaskAt, ss);
    }
    ctx.restore();

    /*
     * THE WORD, up to wherever the front has passed. The arrival field is a
     * threshold, so one pass over the raster builds the layer and the canvas
     * draws it in one go — and the layer is only rebuilt when the front has
     * moved, so a held frame costs one drawImage.
     */
    if (G) {
      /*
       * THE FRONT KEEPS GOING AFTER THE TRUNK HAS STOPPED, or the last
       * letters of a word are never reached: a pixel’s arrival is its arc
       * along the writer PLUS how far off it sits PLUS noise, so the furthest
       * of them is always past the end of the channel. The reveal is paced by
       * whichever is longer, so every pixel is up exactly at the apex.
       */
      const front = growT * Math.max(trunk.len, G.maxT);
      if (!plate || plate.width !== G.w || plate.height !== G.h) {
        plate = document.createElement('canvas');
        plate.width = G.w;
        plate.height = G.h;
        plateAt = -1;
      }
      if (Math.abs(front - plateAt) > 0.25) {
        const pg = plate.getContext('2d');
        if (pg) {
          const img = pg.createImageData(G.w, G.h);
          const d = img.data;
          for (let i = 0; i < G.w * G.h; i += 1) {
            const a0 = G.a[i];
            if (a0 <= 0) continue;
            const v = a0 * smoothstep(G.T[i] - soak, G.T[i], front);
            if (v <= 0) continue;
            // createImageData gives black at 0 alpha, which is exactly this ink
            d[i * 4 + 3] = Math.round(Math.min(1, v) * 255);
          }
          pg.putImageData(img, 0, 0);
          plateAt = front;
        }
      }
      ctx.drawImage(plate, 0, 0);
    }
  };

  return { view, grow: GROW, ms: RUN_MS, draw };
}

/** One channel, from its start to arc `to`, thinning where a letter is under it. */
function strokeTo(
  ctx: CanvasRenderingContext2D,
  c: Channel,
  to: number,
  gmask: (x: number, y: number, ss: number) => number,
  ss: number,
) {
  const { pts, cum, len, w0, w1 } = c;
  for (let i = 1; i < pts.length; i += 1) {
    if (cum[i - 1] >= to) break;
    const a = pts[i - 1];
    let b = pts[i];
    if (cum[i] > to) {
      const k = (to - cum[i - 1]) / Math.max(1e-9, cum[i] - cum[i - 1]);
      b = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    // THE WORD IS NOT A WALL: a stroke thins to nothing over a letter and
    // threads between them, which is what makes the growth WRITE the word
    // rather than score it through.
    let hw = w0 + (w1 - w0) * Math.min(1, cum[i - 1] / Math.max(1e-6, len));
    hw *= 1 - 0.92 * gmask(a.x, a.y, ss);
    if (hw <= 0.05) continue;
    ctx.lineWidth = hw;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}
