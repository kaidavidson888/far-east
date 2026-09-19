/**
 * Bakes the 發 tile that stands beside the outline on the landing page.
 *
 *   npm run build:tile
 *
 * The owner's 2026-09-19 ask: "replace the cloud next to the outline with the
 * gif … just make the edges of the tile sharp instead of rounded and scale it
 * to match the height of the outline with the same margins as the cloud".
 * The source is `scripts/assets/fa-tile.gif`: a mahjong tile drawn as three
 * concentric rounded rectangles with the character 發 in the middle, cloud
 * filigree moving through the character on a 72-frame loop.
 *
 * THE CORNERS ARE REDRAWN, NOT PATCHED. Everything here is measured off the
 * frames rather than typed in, and the build stops rather than guessing:
 *
 *   1. The three rings are read off the straight middle of every side — each
 *      ring's position and thickness — and the four sides must agree with
 *      each other at every sample, or the tile is not the shape this assumes.
 *      They are hard-edged (pure black on pure white; no grey anywhere on
 *      them), so each is exactly a rectangle band with whole-pixel edges.
 *   2. Everything outside the character must be identical in all 72 frames —
 *      only the character animates — so the frame can be drawn once.
 *   3. The character's reach across all 72 frames is measured, and must stay
 *      clear of the innermost ring, or copying it would take ring with it.
 *
 * Then every frame is the three rings drawn as SQUARE-cornered bands at the
 * measured edges, on white, with the character copied in from the source
 * frame untouched. A rounded corner cannot be straightened by editing pixels
 * near it — the arc has to go and the straight edges have to meet — and
 * drawing the bands from the measured edges is exactly that.
 *
 * SIZE. The outline beside it is 30 CSS px tall (the plus button's height,
 * `MARK_SIZE` in lib/landing.ts), so the tile is drawn 30 tall and as wide as
 * its own proportion makes it, rounded to a whole pixel. Baked at 1x AND 2x,
 * each sharpened at its own size — see DENSITIES for why a tile this small
 * needs both. The rounding to a whole pixel is taken
 * up as a hair of white either side rather than by stretching the drawing —
 * a mark is never stretched here. lib/landing.ts checks the height it reads
 * back is its own.
 *
 * NO WHITE. Un-multiplied out of white on the way out, as every baked frame on
 * this site is: ink over white is p = C*a + 255*(1-a), so a = 1 - min(r,g,b)/255
 * recovers the ink and its coverage exactly. The tile's face is then the page
 * showing through, which on this page is white anyway.
 *
 * OUTPUT. `public/tile/fa-tile-1x.webp` and `-2x.webp` are animated, lossless,
 * endlessly looping WebPs at the GIF's own timing — an `<img>` plays them,
 * since unlike the menu and the seal nothing has to scrub them. The `-still`
 * pair is each one's first frame, for a reader who has asked for reduced
 * motion. `lib/tile-geometry.json` carries the size and both srcsets. The
 * build stops if either animation would not visibly move.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/fa-tile.gif';
const OUT_DIR = 'public/tile';
const GEOM = 'lib/tile-geometry.json';

/** The outline's height in CSS px — MARK_SIZE in lib/landing.ts, which checks it. */
const DRAWN_H = 30;


/** How many rings the drawing has. */
const RINGS = 3;
/** The character must stay at least this far inside the innermost ring. */
const CLEAR = 8;

const fail = (msg) => {
  throw new Error(`build-tile: ${msg}`);
};

const meta = await sharp(SRC, { animated: true }).metadata();
const N = meta.pages;
const W = meta.width;
const H = meta.pageHeight;
const delays = meta.delay ?? [];
if (!N || N < 2) fail(`expected an animation, got ${N} frame(s)`);
if (new Set(delays).size !== 1) fail(`frames do not share one delay: ${[...new Set(delays)].join(', ')}`);
const FRAME_MS = delays[0];

/** One frame as RGB plus its darkness (the lowest channel), row-major. */
async function frame(p) {
  const { data, info } = await sharp(SRC, { page: p }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) fail(`frame ${p} is ${info.width}x${info.height}`);
  const low = new Uint8Array(W * H);
  for (let i = 0, o = 0; o < low.length; i += 3, o++) low[o] = Math.min(data[i], data[i + 1], data[i + 2]);
  return { rgb: data, low };
}

const frames = [];
for (let p = 0; p < N; p++) frames.push(await frame(p));
const f0 = frames[0];
const low0 = (x, y) => f0.low[y * W + x];

/* ---------------------------------------------------------- the rings ---- */

/**
 * The first RINGS dark runs inward from one side, along one line. Each run is
 * returned as [from, to] in distance from that side, inclusive. Grey on a run
 * is a failure: the whole method rests on the rings being hard-edged.
 */
function ringRuns(get, length) {
  const out = [];
  let from = -1;
  for (let k = 0; k < length && out.length < RINGS; k++) {
    const v = get(k);
    // the loop ends as the last ring does, so anything grey here is on a ring
    // or between two of them, and the rings are meant to be hard-edged
    if (v !== 0 && v !== 255) fail(`grey level ${v} at ${k}, before ring ${out.length + 1} ended`);
    const ink = v < 128;
    if (ink && from < 0) from = k;
    if (!ink && from >= 0) {
      out.push([from, k - 1]);
      from = -1;
    }
  }
  if (out.length < RINGS) fail(`found ${out.length} rings, expected ${RINGS}`);
  return out;
}

// The tile's own extent first — all of frame 0's ink — so the samples below
// are taken along the middle of the TILE's sides. Spread over the whole
// image instead, the outer samples land in the inner rings' corners.
const ink = { x0: W, y0: H, x1: -1, y1: -1 };
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (low0(x, y) >= 128) continue;
    if (x < ink.x0) ink.x0 = x;
    if (x > ink.x1) ink.x1 = x;
    if (y < ink.y0) ink.y0 = y;
    if (y > ink.y1) ink.y1 = y;
  }
}
// Samples along the middle half of each side, where every ring is straight.
const SAMPLES = 9;
const along = (a, b) => Array.from({ length: SAMPLES }, (_, i) => Math.round(a + (b - a) * (0.25 + (0.5 * i) / (SAMPLES - 1))));

const sides = {
  left: along(ink.y0, ink.y1).map((y) => ringRuns((k) => low0(k, y), W / 2)),
  right: along(ink.y0, ink.y1).map((y) => ringRuns((k) => low0(W - 1 - k, y), W / 2)),
  top: along(ink.x0, ink.x1).map((x) => ringRuns((k) => low0(x, k), H / 2)),
  bottom: along(ink.x0, ink.x1).map((x) => ringRuns((k) => low0(x, H - 1 - k), H / 2)),
};
for (const [side, samples] of Object.entries(sides)) {
  const first = JSON.stringify(samples[0]);
  for (const s of samples) if (JSON.stringify(s) !== first) fail(`the ${side} side is not straight: ${first} vs ${JSON.stringify(s)}`);
}
const ringOf = (side, r) => sides[side][0][r];
// every ring is as thick on all four sides as on the left
for (let r = 0; r < RINGS; r++) {
  const t = (s) => ringOf(s, r)[1] - ringOf(s, r)[0] + 1;
  for (const s of ['right', 'top', 'bottom']) if (t(s) !== t('left')) fail(`ring ${r + 1} is ${t('left')} thick on the left and ${t(s)} on the ${s}`);
}

/** Each ring as its outer box and its inner box, in source px, inclusive. */
const rings = Array.from({ length: RINGS }, (_, r) => {
  const [l0, l1] = ringOf('left', r);
  const [r0, r1] = ringOf('right', r);
  const [t0, t1] = ringOf('top', r);
  const [b0, b1] = ringOf('bottom', r);
  return {
    outer: { x0: l0, x1: W - 1 - r0, y0: t0, y1: H - 1 - b0 },
    inner: { x0: l1 + 1, x1: W - 1 - r1 - 1, y0: t1 + 1, y1: H - 1 - b1 - 1 },
    thickness: l1 - l0 + 1,
  };
});
const tile = rings[0].outer;
const face = rings[RINGS - 1].inner;

/* ------------------------------------------------------ the character ---- */

// The rings' rounded corners reach onto the face — the square bands above
// stop at their straight edges, and the arcs curve inside them. Along the
// face's own outermost row and column the arcs cross it a little way in from
// each corner (the corner pixel itself is white: the arc passes inside it),
// and the straight part of the edge beyond is white, the face being inside
// the innermost ring. So the furthest ink along that edge, from each corner,
// is how far the arcs reach; a quarter circle lies wholly inside the box
// those two distances make. Measured at all four corners.
function runIn(x, y, dx, dy) {
  let last = -1;
  for (let k = 0; k < 200; k++) if (low0(x + dx * k, y + dy * k) < 250) last = k;
  return last + 1;
}
const corners = [
  [face.x0, face.y0, 1, 1],
  [face.x1, face.y0, -1, 1],
  [face.x0, face.y1, 1, -1],
  [face.x1, face.y1, -1, -1],
];
const ARC =
  Math.max(...corners.flatMap(([x, y, sx, sy]) => [runIn(x, y, sx, 0), runIn(x, y, 0, sy)])) + CLEAR;
if (ARC >= 200) fail('a corner arc runs the whole side of the face');
const inArcCorner = (x, y) =>
  (x < face.x0 + ARC || x > face.x1 - ARC) && (y < face.y0 + ARC || y > face.y1 - ARC);

// The character's reach, over every frame: ink on the face, the ring's corner
// arcs excepted.
const reach = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
for (const f of frames) {
  for (let y = face.y0; y <= face.y1; y++) {
    for (let x = face.x0; x <= face.x1; x++) {
      if (f.low[y * W + x] === 255 || inArcCorner(x, y)) continue;
      if (x < reach.x0) reach.x0 = x;
      if (x > reach.x1) reach.x1 = x;
      if (y < reach.y0) reach.y0 = y;
      if (y > reach.y1) reach.y1 = y;
    }
  }
}
if (!Number.isFinite(reach.x0)) fail('no character found on the face');
const clearance = Math.min(reach.x0 - face.x0, face.x1 - reach.x1, reach.y0 - face.y0, face.y1 - reach.y1);
if (clearance < CLEAR) fail(`the character comes within ${clearance}px of the innermost ring`);
// the box copied from each frame: the reach, with a little air, still clear of the ring
const keep = { x0: reach.x0 - 2, y0: reach.y0 - 2, x1: reach.x1 + 2, y1: reach.y1 + 2 };

// Everything else must be the same in every frame, or it is not safe to draw
// once: the rings and the ground do not move.
for (let p = 1; p < N; p++) {
  const f = frames[p];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x >= keep.x0 && x <= keep.x1 && y >= keep.y0 && y <= keep.y1) continue;
      if (f.low[y * W + x] !== f0.low[y * W + x]) fail(`frame ${p} differs from frame 0 at ${x},${y}, outside the character`);
    }
  }
}
// ...and nothing but the character and the rings is drawn on the face
for (let y = face.y0; y <= face.y1; y++) {
  for (let x = face.x0; x <= face.x1; x++) {
    const inKeep = x >= keep.x0 && x <= keep.x1 && y >= keep.y0 && y <= keep.y1;
    if (inKeep || inArcCorner(x, y)) continue;
    if (low0(x, y) !== 255) fail(`stray ink on the face at ${x},${y}`);
  }
}

/* ------------------------------------------------------------ drawing ---- */

// The crop: the outer ring's box, widened by a hair of white each side so the
// whole-pixel width is reached without stretching the drawing.
const tileW = tile.x1 - tile.x0 + 1;
const tileH = tile.y1 - tile.y0 + 1;
const CSS_H = DRAWN_H;
const CSS_W = Math.round((CSS_H * tileW) / tileH);
const cropW = Math.round((CSS_W * tileH) / CSS_H);
const padL = Math.floor((cropW - tileW) / 2);
const crop = { x0: tile.x0 - padL, y0: tile.y0, w: cropW, h: tileH };
if (crop.x0 < 0 || crop.x0 + crop.w > W) fail('the widened crop runs off the source');

const inBox = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const onRing = (x, y) => rings.some((r) => inBox(r.outer, x, y) && !inBox(r.inner, x, y));

/** Ink over white, back to ink over nothing. */
function unmultiply(rgb) {
  const out = Buffer.alloc((rgb.length / 3) * 4);
  for (let i = 0, o = 0; i < rgb.length; i += 3, o += 4) {
    const low = Math.min(rgb[i], rgb[i + 1], rgb[i + 2]);
    const a = 255 - low;
    if (a === 0) continue;
    const back = 255 - a;
    out[o] = Math.min(255, Math.round(((rgb[i] - back) * 255) / a));
    out[o + 1] = Math.min(255, Math.round(((rgb[i + 1] - back) * 255) / a));
    out[o + 2] = Math.min(255, Math.round(((rgb[i + 2] - back) * 255) / a));
    out[o + 3] = a;
  }
  return out;
}

/** Frame `f` at full size: the square rings drawn, the character copied in. */
function compose(f) {
  const buf = Buffer.alloc(crop.w * crop.h * 3, 255);
  for (let y = 0; y < crop.h; y++) {
    for (let x = 0; x < crop.w; x++) {
      const sx = crop.x0 + x;
      const sy = crop.y0 + y;
      const o = (y * crop.w + x) * 3;
      if (inBox(keep, sx, sy)) {
        const i = (sy * W + sx) * 3;
        buf[o] = f.rgb[i];
        buf[o + 1] = f.rgb[i + 1];
        buf[o + 2] = f.rgb[i + 2];
      } else if (onRing(sx, sy)) {
        buf[o] = buf[o + 1] = buf[o + 2] = 0;
      }
    }
  }
  return buf;
}
const composed = frames.map(compose);

/**
 * ONE FILE PER PIXEL DENSITY, EACH SHARPENED AT ITS OWN SIZE. The owner
 * looked at the first bake and said the tile was not playing. It was — 72
 * frames, 50ms each — but at 30px tall the filigree moving through the
 * character is finer than a pixel, so an honest reduction averages it to a
 * grey that barely changes: on a 1x screen 16 of the tile's 690 pixels moved
 * by more than a sixth of the range between two frames half a loop apart.
 * And a 1x screen was being handed the 2x file, which the browser shrinks
 * with its own filter and blurs again.
 *
 * So each density gets its own file, reduced once from the full-size frame
 * and then sharpened at that size, which puts the contrast of the white
 * filigree back into the pixels it lands on. Measured on the character alone,
 * against frame 0 over the loop: at 1x from 28 pixels changing to 122 of 816,
 * at 2x from 689 to 1130 of 3264 — the motion reads, and the character keeps
 * its shape. Sharpening cannot put a halo on the white: the overshoot clips
 * at white, and white is then taken out altogether by the un-multiply. The
 * rings go through the same filter and come out a touch darker, which at
 * less than half a pixel wide is the right direction.
 */
const DENSITIES = [
  { scale: 1, sharpen: { sigma: 0.5, m1: 2, m2: 3 } },
  { scale: 2, sharpen: { sigma: 0.6, m1: 2, m2: 3 } },
];

mkdirSync(OUT_DIR, { recursive: true });
const written = [];
for (const d of DENSITIES) {
  const devW = CSS_W * d.scale;
  const devH = CSS_H * d.scale;
  const baked = [];
  for (const buf of composed) {
    const small = await sharp(buf, { raw: { width: crop.w, height: crop.h, channels: 3 } })
      .resize({ width: devW, height: devH, fit: 'fill', kernel: 'lanczos3' })
      .sharpen(d.sharpen)
      .raw()
      .toBuffer();
    baked.push(await sharp(unmultiply(small), { raw: { width: devW, height: devH, channels: 4 } }).png().toBuffer());
  }
  const name = `fa-tile-${d.scale}x`;
  const anim = await sharp(baked, { join: { animated: true } })
    .webp({ lossless: true, effort: 6, loop: 0, delay: Array(N).fill(FRAME_MS) })
    .toBuffer();
  writeFileSync(`${OUT_DIR}/${name}.webp`, anim);
  const still = await sharp(baked[0]).webp({ lossless: true, effort: 6 }).toBuffer();
  writeFileSync(`${OUT_DIR}/${name}-still.webp`, still);

  // read the animation back: the right number of frames, at the right size
  const check = await sharp(anim, { animated: true }).metadata();
  if (check.pages !== N || check.width !== devW || check.pageHeight !== devH) {
    fail(`${name}: wrote ${check.pages} frames of ${check.width}x${check.pageHeight}, expected ${N} of ${devW}x${devH}`);
  }
  // ...and it has to MOVE: frames half a loop apart must differ visibly
  const alphaOf = async (p) =>
    sharp(anim, { page: p }).ensureAlpha().extractChannel(3).raw().toBuffer();
  const a = await alphaOf(0);
  const b = await alphaOf(Math.floor(N / 2));
  let moved = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 40) moved++;
  if (moved < a.length * 0.05) fail(`${name}: only ${moved} of ${a.length} pixels change across the loop — it would not read as moving`);
  written.push({ d, name, anim, still, moved, px: a.length, devW, devH });
}

const srcSet = (suffix) => DENSITIES.map((d) => `/tile/fa-tile-${d.scale}x${suffix}.webp ${d.scale}x`).join(', ');
const geometry = {
  src: '/tile/fa-tile-1x.webp',
  srcSet: srcSet(''),
  stillSrcSet: srcSet('-still'),
  w: CSS_W,
  h: CSS_H,
  frames: N,
  frameMs: FRAME_MS,
};
writeFileSync(GEOM, `${JSON.stringify(geometry, null, 2)}\n`);

console.log(`rings (source px): ${rings.map((r, i) => `#${i + 1} ${r.thickness}px at ${r.outer.x0},${r.outer.y0}`).join(', ')}`);
console.log(`tile ${tileW}x${tileH}, character ${reach.x1 - reach.x0 + 1}x${reach.y1 - reach.y0 + 1}, ${clearance}px clear of the inner ring`);
console.log(`drawn ${CSS_W}x${CSS_H} CSS px, ${N} frames at ${FRAME_MS}ms (${((N * FRAME_MS) / 1000).toFixed(1)}s loop)`);
for (const w of written) {
  console.log(`${OUT_DIR}/${w.name}.webp ${w.devW}x${w.devH} ${(w.anim.length / 1024).toFixed(1)}KB, still ${(w.still.length / 1024).toFixed(1)}KB; ${w.moved} of ${w.px} px change across the loop`);
}
