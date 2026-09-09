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
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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

// The login box's black content — EMAIL / PASSWORD / create account·login, the
// dashed lines and the ☁ glyphs — is stripped out of the frames entirely; the
// overlay fades it back in instead (see SPLASH_BOX_INK_B64 below). The strip is
// the box inset by INK_INSET, so the box's own outline is never touched, and it
// only applies from INK_GATE on: the 遠東 seal drains through the same rectangle
// and is still there up to frame 28. Measured off the source, the inset box
// holds exactly zero black at frames 30-32 — the logo has gone and the login box
// has not started — so the gate lands in a genuine gap and shows no seam.
const INK_BOX = { x0: 0.3312, x1: 0.6672, y0: 0.4241, y1: 0.5752 }; // == SPLASH_GEOM.box
const INK_INSET = 0.04; // fraction of the box, keeps the red outline out of it
const INK_GATE = 30;
const IKX0 = Math.round((INK_BOX.x0 + INK_INSET * (INK_BOX.x1 - INK_BOX.x0)) * W);
const IKX1 = Math.round((INK_BOX.x1 - INK_INSET * (INK_BOX.x1 - INK_BOX.x0)) * W);
const IKY0 = Math.round((INK_BOX.y0 + INK_INSET * (INK_BOX.y1 - INK_BOX.y0)) * H);
const IKY1 = Math.round((INK_BOX.y1 - INK_INSET * (INK_BOX.y1 - INK_BOX.y0)) * H);

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
      const px = (i >> 2) % W, py = ((i >> 2) / W) | 0;
      const stripped = n >= INK_GATE && px >= IKX0 && px < IKX1 && py >= IKY0 && py < IKY1;
      const cov = stripped ? 0 : crisp(1 - max / 255) * blackAlpha; // 0 → the black vanishes
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

// Per-frame edge-coverage profile: EBANDS horizontal bands, red density in a
// thin strip just inside the LEFT frame edge then the RIGHT. paint() reveals the
// tiled margins through this so they finger outward in the frame's own organic
// shape — baked so paint() never has to getImageData (that stretched the
// animation on slower machines).
const EBANDS = 44;
function edgeProfile(d) {
  const out = new Uint8Array(EBANDS * 2);
  const per = H / EBANDS;
  for (let b = 0; b < EBANDS; b++) {
    const y0 = Math.floor(b * per), y1 = Math.floor((b + 1) * per);
    let lHit = 0, lTot = 0, rHit = 0, rTot = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 2; x < 12; x++) { const i = (y * W + x) * 4; lTot++; if (d[i] - d[i + 1] > 26 && d[i] > 120) lHit++; }
      for (let x = W - 12; x < W - 2; x++) { const i = (y * W + x) * 4; rTot++; if (d[i] - d[i + 1] > 26 && d[i] > 120) rHit++; }
    }
    out[b] = Math.round(255 * (lTot ? lHit / lTot : 0));
    out[EBANDS + b] = Math.round(255 * (rTot ? rHit / rTot : 0));
  }
  return out;
}
const edgeProfiles = [];
// Per-frame "how much of the login box's black has arrived", 0..255 — the share
// of the FINAL content's pixels that are already inked. Monotonic, unlike a raw
// count (transitional strokes overshoot around frame 80 and settle back). The
// overlay fades in on this, so it arrives exactly as the stripped black would
// have spread.
const boxInkCounts = [];
const inkPx = (d, i) => { const mx = Math.max(d[i], d[i+1], d[i+2]); return mx < 200 && mx - Math.min(d[i], d[i+1], d[i+2]) < 40; };
function inkMaskOf(d) {
  const m = new Uint8Array(W * H);
  for (let y = IKY0; y < IKY1; y++) for (let x = IKX0; x < IKX1; x++) { const i = (y * W + x) * 4; if (inkPx(d, i)) m[y * W + x] = 1; }
  return m;
}
function inkCovered(d, mask) {
  let n = 0;
  for (let y = IKY0; y < IKY1; y++) for (let x = IKX0; x < IKX1; x++) { const k = y * W + x; if (mask[k] && inkPx(d, k * 4)) n++; }
  return n;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const blank = () => {
  const b = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { b[i * 4] = 255; b[i * 4 + 1] = 255; b[i * 4 + 2] = 255; b[i * 4 + 3] = 255; }
  return b;
};
const paste = (dst, f) => {
  const { width: fw, height: fh, top, left } = f.dims;
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const pi = (y * fw + x) * 4;
      if (f.patch[pi + 3] === 0) continue;
      const cx = left + x, cy = top + y;
      if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
      const ci = (cy * W + cx) * 4;
      dst[ci] = f.patch[pi]; dst[ci + 1] = f.patch[pi + 1]; dst[ci + 2] = f.patch[pi + 2]; dst[ci + 3] = 255;
    }
  }
};

// A pre-pass composites the whole GIF so the FINAL ink mask is known before the
// first frame is written — the main loop only ever holds a running accumulation.
const finalAcc = blank();
for (const f of frames) paste(finalAcc, f);
const INK_MASK = inkMaskOf(finalAcc);
const INK_TOTAL = Math.max(1, inkCovered(finalAcc, INK_MASK));

const acc = blank();

let written = 0;
for (let n = 0; n < frames.length; n++) {
  paste(acc, frames[n]);
  boxInkCounts.push(Math.round((255 * inkCovered(acc, INK_MASK)) / INK_TOTAL));

  const snap = Buffer.from(acc);
  process(snap, n);
  edgeProfiles.push(edgeProfile(snap));
  const png = new PNG({ width: W, height: H });
  snap.copy(png.data);
  await sharp(PNG.sync.write(png))
    .resize({ width: WIDTH })
    .sharpen({ sigma: 0.5 })
    .webp({ quality: QUALITY })
    .toFile(`${OUT}/f${String(written).padStart(3, '0')}.webp`);
  written++;
}

// edge.webp stays ink-on-WHITE — the paper is part of the bake, and giving it
// an alpha channel instead triples the file. paint() draws the margins with
// 'multiply', for which white is the identity, so the tile's background has no
// effect on the page and soft ink composites exactly as if it were transparent.
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
const INK_GAMMA = 0.6; // < 1 thickens the overlay text
// Build the ink as grey-on-white RGB and push it through the frames' exact
// resize + sharpen, THEN turn grey into alpha. Writing straight into an alpha
// channel instead loses the strokes: sharp premultiplies on resize, so the
// anti-aliased edges erode and the text lands at roughly half the weight of the
// same text baked into the frame.
const ink = Buffer.from(acc);
for (let i = 0; i < ink.length; i += 4) {
  const max = Math.max(ink[i], ink[i + 1], ink[i + 2]);
  const chroma = max - Math.min(ink[i], ink[i + 1], ink[i + 2]);
  const cov = max < 245 && chroma < 28 ? crisp(1 - max / 255) : 0;
  const v = Math.round(255 - 255 * cov); // identical to process()'s INK branch
  ink[i] = ink[i + 1] = ink[i + 2] = v;
  ink[i + 3] = 255;
}
const ipng = new PNG({ width: W, height: H });
ink.copy(ipng.data);
const RH = Math.round((WIDTH * H) / W);
const BX = {
  left: Math.round(BOX.x0 * WIDTH),
  top: Math.round(BOX.y0 * RH),
  width: Math.round((BOX.x1 - BOX.x0) * WIDTH),
  height: Math.round((BOX.y1 - BOX.y0) * RH),
};
const grey = await sharp(PNG.sync.write(ipng))
  .resize({ width: WIDTH })
  .sharpen({ sigma: 0.5 })
  .extract(BX)
  .removeAlpha()
  .raw()
  .toBuffer();
const bpng = new PNG({ width: BX.width, height: BX.height });
for (let px = 0; px < BX.width * BX.height; px++) {
  bpng.data[px * 4] = 0;
  bpng.data[px * 4 + 1] = 0;
  bpng.data[px * 4 + 2] = 0;
  // Gamma < 1 lifts partial coverage, so the strokes read bolder than the
  // baked copy without going blurry (a blur would widen them but soften the
  // edges; this keeps them crisp).
  const cov = (255 - grey[px * 3]) / 255;
  bpng.data[px * 4 + 3] = Math.round(255 * Math.min(1, Math.pow(cov, INK_GAMMA)));
}
await sharp(PNG.sync.write(bpng))
  .webp({ quality: 96, alphaQuality: 100 })
  .toFile('public/splash/blackbox.webp');

// blackbox-bold.webp — the same sprite with the strokes thickened, used by
// SplashLoginFields for the LABEL windows only (EMAIL / PASSWORD / create
// account·login), so the words go bold while the ☁ glyphs and the dashed lines
// keep the weight they have in the baked box.
//
// The dilation runs on the FULL-RESOLUTION ink and is then put through the same
// resize + sharpen. At 215px the sprite's caps are only ~10px tall, so dilating
// after the downscale moves a whole pixel and fills the counters in; at 720px a
// 2px round kernel lands as a sub-pixel weight increase that survives resampling
// as a heavier stroke rather than a blob.
const BOLD_R = 1; // dilation radius, full-resolution pixels
const bold = Buffer.from(ink);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let m = 0; // max ink coverage in the neighbourhood
    for (let dy = -BOLD_R; dy <= BOLD_R; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (let dx = -BOLD_R; dx <= BOLD_R; dx++) {
        const xx = x + dx;
        if (dx * dx + dy * dy > BOLD_R * BOLD_R) continue; // round kernel
        if (xx < 0 || xx >= W) continue;
        const v = 255 - ink[(yy * W + xx) * 4];
        if (v > m) m = v;
      }
    }
    const o = (y * W + x) * 4;
    bold[o] = bold[o + 1] = bold[o + 2] = 255 - m;
  }
}
const bipng = new PNG({ width: W, height: H });
bold.copy(bipng.data);
const bgrey = await sharp(PNG.sync.write(bipng))
  .resize({ width: WIDTH })
  .sharpen({ sigma: 0.5 })
  .extract(BX)
  .removeAlpha()
  .raw()
  .toBuffer();
const boldPng = new PNG({ width: BX.width, height: BX.height });
for (let px = 0; px < BX.width * BX.height; px++) {
  boldPng.data[px * 4] = boldPng.data[px * 4 + 1] = boldPng.data[px * 4 + 2] = 0;
  const cov = (255 - bgrey[px * 3]) / 255;
  boldPng.data[px * 4 + 3] = Math.round(255 * Math.min(1, Math.pow(cov, INK_GAMMA)));
}
await sharp(PNG.sync.write(boldPng))
  .webp({ quality: 96, alphaQuality: 100 })
  .toFile('public/splash/blackbox-bold.webp');

// Normalise every band against its OWN fully-grown value (the last frame), so a
// band means "how far has the design grown here", not "how dense is the pattern
// here". Raw density peaks near 0.36 — a sparse line pattern is mostly paper —
// and feeding that straight in as mask alpha held the margins at roughly a third
// strength for the whole run, i.e. a permanent white wash beside a 1:1 centre.
const finalProf = Uint8Array.from(edgeProfiles[edgeProfiles.length - 1]);
for (const prof of edgeProfiles) {
  for (let i = 0; i < prof.length; i++) {
    prof[i] = Math.round(255 * clamp01(prof[i] / Math.max(finalProf[i], 24)));
  }
}
const edgeBuf = Buffer.concat(edgeProfiles.map((u) => Buffer.from(u)));
// Before INK_GATE the count is the 遠東 seal happening to overlap the final ink
// mask (a flat ~0.23), not the login box arriving — zero it, then keep the ramp
// monotonic so the overlay only ever fades up.
for (let n = 0; n < boxInkCounts.length; n++) {
  if (n < INK_GATE) boxInkCounts[n] = 0;
  else if (n > 0) boxInkCounts[n] = Math.max(boxInkCounts[n], boxInkCounts[n - 1]);
}
const inkBuf = Buffer.from(boxInkCounts);
writeFileSync(
  'lib/splashEdgeProfile.ts',
  `// GENERATED by scripts/build-splash-frames.mjs — do not edit.\n` +
    `// ${edgeProfiles.length} frames x ${EBANDS} bands x 2 sides, one byte each.\n` +
    `export const SPLASH_EDGE_BANDS = ${EBANDS};\n` +
    `export const SPLASH_EDGE_B64 =\n  '${edgeBuf.toString('base64')}';\n` +
    `\n// One byte per frame: how much of the login box's black content had drawn\n` +
    `// in, 0..255. It is stripped out of the frames; the overlay fades in on it.\n` +
    `export const SPLASH_BOX_INK_B64 =\n  '${inkBuf.toString('base64')}';\n`,
);
console.log(`wrote ${written} frames + edge/settle/blackbox+bold.webp + lib/splashEdgeProfile.ts (${edgeBuf.length}B)`);
