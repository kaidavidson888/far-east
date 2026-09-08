/**
 * Bakes the splash animation (scripts/assets/login-source.gif) into scrubbable
 * WebP stills — a faithful copy of the original, changed only in:
 *   - colour:   red → #FF0000, black → #000000, white kept
 *   - sharpness: full resolution + a light unsharp pass
 *   - opacity:   the red seal panel fades as it drains; the red cloud design
 *                rises from faint to 100% over the run (frames 0 → 100)
 *
 * The frames keep the original login box's red outline. Also writes:
 *   edge.webp     the final red pattern, box reflected over, tiled left/right
 *                 at paint time (it tiles horizontally)
 *   settle.webp   the last frame with every black part at 0 — cross-faded in on
 *                 latch so the baked black goes to 0 without a white patch
 *   blackbox.webp the box's black content only (transparent bg), cropped to the
 *                 box — SplashLoginFields shows per-part windows of it, so the
 *                 crisp overlay is pixel-exact with the baked box
 *
 *   npm run build:splash   (runs split-loginbox.mjs first)
 *
 * 101 frames, 40ms apart — exactly the source timing (4.0s). GIF frames are
 * patches that composite on top of each other (disposal type 1). Commit the
 * output; nothing decodes the GIF at runtime.
 */
import { readFileSync, mkdirSync, rmSync } from 'node:fs';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const SRC = 'scripts/assets/login-source.gif';
const OUT = 'public/splash/frames';
const WIDTH = 640;
const EDGE_WIDTH = 900;
const QUALITY = 80;

const RED = [0xff, 0x00, 0x00];
const INK = [0x00, 0x00, 0x00];

// The seal panel / login box live here; clouds are everything outside it.
const C = { x0: 0.29, x1: 0.71, y0: 0.4, y1: 0.59, feather: 0.045 };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);
const crisp = (c) => {
  const t = clamp01(c);
  return t < 0.16 ? 0 : t > 0.92 ? 1 : (t - 0.16) / 0.76;
};

const gif = parseGIF(readFileSync(SRC));
const frames = decompressFrames(gif, true);
const W = gif.lsd.width, H = gif.lsd.height;
const LAST = frames.length - 1;

function centreWeight(fx, fy) {
  const sx = Math.min((fx - (C.x0 - C.feather)) / C.feather, ((C.x1 + C.feather) - fx) / C.feather, 1);
  const sy = Math.min((fy - (C.y0 - C.feather)) / C.feather, ((C.y1 + C.feather) - fy) / C.feather, 1);
  return clamp01(Math.min(sx, sy));
}

// Replace the box region with clean pattern reflected in from just outside each
// side of it: left half mirrors the strip left of the box, right half mirrors
// the strip to its right. Same rows → top/bottom edges match exactly (no
// horizontal seam to streak across the tiled margins); left/right box edges are
// seamless mirror continuations. The only join is a short vertical seam down the
// box centre, which the login box itself sits over. Hard copy — no ghost.
function cloudFill(d, src, R, strength) {
  if (strength <= 0) return;
  const x0 = Math.floor(R.x0 * W), x1 = Math.ceil(R.x1 * W);
  const y0 = Math.floor(R.y0 * H), y1 = Math.ceil(R.y1 * H);
  const w = clamp01(strength);
  const mid = (x0 + x1) >> 1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const sx = x < mid ? 2 * x0 - x - 1 : 2 * x1 - x - 1;
      if (sx < 0 || sx >= W) continue;
      const i = (y * W + x) * 4;
      const is = (y * W + sx) * 4;
      for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - w) + src[is + k] * w;
    }
  }
}
// generously covers the original login box (border + labels). The left/right/
// top/bottom joins are seamless mirror continuations; only the box-centre join
// is hard, and the login box sits over it.
const BOX_R = { x0: 0.318, x1: 0.682, y0: 0.412, y1: 0.582 };

function process(d, n, blackAlpha = 1) {
  const p = n / LAST;
  const cloudRise = clamp01(0.12 + 0.88 * Math.pow(p, 0.7)); // faint → 100% at 4s
  const sealFade = clamp01(1 - p / 0.44); // the draining panel fades out by ~frame 44
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const max = Math.max(r, g, b);
    const chroma = max - Math.min(r, g, b);
    if (max > 250 && chroma < 8) continue; // white paper

    if (chroma < 24) {
      const cov = crisp(1 - max / 255) * blackAlpha; // blackAlpha 0 → the black vanishes
      d[i] = 255 + (INK[0] - 255) * cov;
      d[i + 1] = 255 + (INK[1] - 255) * cov;
      d[i + 2] = 255 + (INK[2] - 255) * cov;
    } else if (r === max) {
      const cov = crisp(1 - (g + b) / 510);
      const cw = centreWeight(((i >> 2) % W) / W, (((i >> 2) / W) | 0) / H);
      // centre red follows the draining panel; outside it follows the rising clouds.
      const alpha = cw > 0 ? Math.max(sealFade, cloudRise) * cw + cloudRise * (1 - cw) : cloudRise;
      const a = cov * clamp01(alpha);
      d[i] = 255 + (RED[0] - 255) * a;
      d[i + 1] = 255 + (RED[1] - 255) * a;
      d[i + 2] = 255 + (RED[2] - 255) * a;
    }
  }
}

// The frames keep the original login box (it draws itself out of the drain —
// the DOM box + its white backing reveal top-down over it at paint time). Only
// the tile needs it gone.
//
// The seamless tile: frame 100's pattern with the box reflected over, used to
// continue the design past the frame edge (the pattern tiles horizontally).
function buildEdge(raw) {
  const d = Buffer.from(raw);
  process(d, LAST); // recolour at the final state
  cloudFill(d, Buffer.from(d), BOX_R, 1);
  return d;
}

// How far down the frame the cloud pattern has spread (0..1) — the last row,
// scanning top-down over the full width, that still has red. Used to reveal the
// edge tiles in step with the animation so the margins don't run ahead.
function patternSpread(d) {
  // Only the very edges of the frame — that's where the tiles butt on — so the
  // tiles are held back until the pattern has actually reached the frame edge.
  const cols = [];
  for (let x = 2; x < W * 0.09; x += 2) cols.push(x);
  for (let x = Math.floor(W * 0.91); x < W - 2; x += 2) cols.push(x);
  for (let y = H - 1; y >= 0; y--) {
    let red = 0;
    for (const x of cols) {
      const i = (y * W + x) * 4;
      if (d[i] - d[i + 1] > 40 && d[i] > 150) red++;
      if (red >= 5) return (y + 1) / H;
    }
  }
  return 0;
}
const spreadProfile = [];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const acc = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { acc[i * 4] = 255; acc[i * 4 + 1] = 255; acc[i * 4 + 2] = 255; acc[i * 4 + 3] = 255; }

let written = 0;
for (let n = 0; n < frames.length; n++) {
  const f = frames[n];
  const { width: fw, height: fh, top, left } = f.dims;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const pi = (y * fw + x) * 4;
      if (f.patch[pi + 3] === 0) continue;
      const cx = left + x, cy = top + y;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const ci = (cy * W + cx) * 4;
      acc[ci] = f.patch[pi];
      acc[ci + 1] = f.patch[pi + 1];
      acc[ci + 2] = f.patch[pi + 2];
      acc[ci + 3] = 255;
    }
  }

  const snap = Buffer.from(acc);
  process(snap, n);
  spreadProfile.push(patternSpread(snap));
  const png = new PNG({ width: W, height: H });
  snap.copy(png.data);
  await sharp(PNG.sync.write(png))
    .resize({ width: WIDTH })
    .sharpen({ sigma: 0.5 })
    .webp({ quality: QUALITY })
    .toFile(`${OUT}/f${String(written).padStart(3, '0')}.webp`);
  written++;
}

const edge = buildEdge(acc);
const epng = new PNG({ width: W, height: H });
edge.copy(epng.data);
await sharp(PNG.sync.write(epng))
  .resize({ width: EDGE_WIDTH })
  .sharpen({ sigma: 0.4 })
  .webp({ quality: QUALITY })
  .toFile('public/splash/edge.webp');

// settle.webp — the final frame with every black part at 0 (red, incl. the box
// outline, untouched). Cross-faded over the last frame once the animation
// latches, so the baked black fades to 0 in place.
const settle = Buffer.from(acc);
process(settle, LAST, 0);
const stpng = new PNG({ width: W, height: H });
settle.copy(stpng.data);
await sharp(PNG.sync.write(stpng))
  .resize({ width: WIDTH })
  .sharpen({ sigma: 0.5 })
  .webp({ quality: QUALITY })
  .toFile('public/splash/settle.webp');

// blackbox.webp — the login box's black content (EMAIL/PASSWORD/create-account
// labels, the ☁ glyphs, the dashed lines + left tick) as one transparent sprite
// cropped to the box region, at the SAME resize + sharpen as the frames.
// SplashLoginFields shows per-part windows of it at the per-part opacities, so
// the crisp overlay is pixel-exact with the box baked into the frames (which
// settle.webp fades out underneath it). Box crop == SPLASH_GEOM.box.
const BOX = { x0: 0.3312, x1: 0.6672, y0: 0.4241, y1: 0.5752 };
const ink = Buffer.from(acc);
for (let i = 0; i < ink.length; i += 4) {
  const max = Math.max(ink[i], ink[i + 1], ink[i + 2]);
  const chroma = max - Math.min(ink[i], ink[i + 1], ink[i + 2]);
  if (max < 245 && chroma < 28) {
    const cov = crisp(1 - max / 255);
    ink[i] = ink[i + 1] = ink[i + 2] = 0;
    ink[i + 3] = Math.round(cov * 255);
  } else {
    ink[i + 3] = 0;
  }
}
const ipng = new PNG({ width: W, height: H });
ink.copy(ipng.data);
const RH = Math.round((WIDTH * H) / W);
await sharp(PNG.sync.write(ipng))
  .resize({ width: WIDTH })
  .sharpen({ sigma: 0.5 })
  .extract({
    left: Math.round(BOX.x0 * WIDTH),
    top: Math.round(BOX.y0 * RH),
    width: Math.round((BOX.x1 - BOX.x0) * WIDTH),
    height: Math.round((BOX.y1 - BOX.y0) * RH),
  })
  .webp({ quality: 94, alphaQuality: 100 })
  .toFile('public/splash/blackbox.webp');

// smooth + monotonic (spread only grows), rounded
let mx = 0;
const spread = spreadProfile.map((v) => (mx = Math.max(mx, v))).map((v) => +v.toFixed(3));
console.log(`wrote ${written} frames to ${OUT}/ + edge.webp (${W}x${H} → ${WIDTH}px / ${EDGE_WIDTH}px)`);
console.log('SPLASH_SPREAD =', JSON.stringify(spread));
