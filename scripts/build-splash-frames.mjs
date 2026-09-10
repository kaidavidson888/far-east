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
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

// The login box's finished black — EMAIL / PASSWORD / create account·login, the
// dashed lines and the ☁ glyphs — is stripped out of the frames; the overlay
// fades in over the top instead. The strip is shape-scoped, not rectangle-
// scoped: only pixels the FINAL frame inks are cleared (INK_STRIP), so the
// tendrils that branch in and settle into those words are left alone and still
// grow, exactly as in the source — they just never land. It only applies from
// INK_GATE on: the 遠東 seal drains through the same rectangle and is still
// there at frame 28. Measured off the source, the inset box holds 1473 black
// pixels at f28 and exactly zero at f30-32 — the logo has gone and the login box
// has not started — so the gate sits in a genuine gap and shows no seam.
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
      const stripped = n >= INK_GATE && INK_STRIP[py * W + px] === 1;
      const cov = stripped ? 0 : crisp(1 - max / 255) * blackAlpha;
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
const inkPx = (d, i) => { const mx = Math.max(d[i], d[i+1], d[i+2]); return mx < 200 && mx - Math.min(d[i], d[i+1], d[i+2]) < 40; };
// INK_STRIP is every pixel the words occupy while they finish — the union of
// the ink inside the box over frames INK_UNION_FROM..LAST, grown by
// INK_STRIP_R so no anti-aliased halo is left behind. All of it is deleted.
//
// The union, rather than just the last frame: the source draws each word with a
// few pixels of wobble before it settles, so a mask taken from f100 alone
// leaves those near-final strokes behind, and late in the run they read as a
// second, legible copy of the word — sitting where the baked box was rather
// than where the overlay now sits. Taking the union deletes them as well.
//
// It is also gentler on the tendrils than simply widening the mask, because it
// only covers where the words actually went. Black left inside the box at f70:
// 2052px with an f100 mask (ghosts), 942px with a blanket 8px one, 1073px with
// this — and 0 from f88 either way.
const INK_STRIP_R = 2;
const INK_UNION_FROM = 88;
function markInk(d, into) {
  for (let y = IKY0; y < IKY1; y++) for (let x = IKX0; x < IKX1; x++) { if (inkPx(d, (y * W + x) * 4)) into[y * W + x] = 1; }
}
function dilateMask(hit, R) {
  const m = new Uint8Array(W * H);
  for (let y = IKY0; y < IKY1; y++) {
    for (let x = IKX0; x < IKX1; x++) {
      let on = 0;
      for (let dy = -R; dy <= R && !on; dy++) {
        const yy = y + dy;
        if (yy < IKY0 || yy >= IKY1) continue;
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue;
          const xx = x + dx;
          if (xx < IKX0 || xx >= IKX1) continue;
          if (hit[yy * W + xx]) { on = 1; break; }
        }
      }
      if (on) m[y * W + x] = 1;
    }
  }
  return m;
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

// A pre-pass composites the whole GIF so the strip mask is known before the
// first frame is written — the main loop only ever holds a running accumulation.
const finalAcc = blank();
const inkUnion = new Uint8Array(W * H);
for (let n = 0; n < frames.length; n++) {
  paste(finalAcc, frames[n]);
  if (n >= INK_UNION_FROM) markInk(finalAcc, inkUnion);
}
const INK_STRIP = dilateMask(inkUnion, INK_STRIP_R);

const acc = blank();

let written = 0;
for (let n = 0; n < frames.length; n++) {
  paste(acc, frames[n]);

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


// phone-label.webp — the EMAIL row's label, supplied as vector art rather than
// taken from the baked box.
//
// It is baked at the SAME pixel density as blackbox.webp: its ink ends up
// PHONE_INK_H tall, which is what the sprite's own labels are, and it goes
// through the same sharpen and INK_GAMMA. Delivered at its native resolution
// instead (1538 x 273) it was vector-crisp beside 15px bitmap text the frame
// pipeline had already softened — the browser reduced the art 38x to reach the
// screen and the sprite only 2x. The strokes measure the same width either way,
// and Chrome's own resampling actually leaves the art LIGHTER (mean alpha 0.513
// against the sprite's 0.579), but crisp edges read as bold and soft ones read
// as thin, so the row looked heavier than the two below it.
//
// == SPLASH_GEOM's EMAIL_LABEL.h (0.0698 of the box) x the box crop.
const PHONE_INK_H = Math.round(0.0698 * BX.height);
// How much to thin the artwork's strokes before the downscale, in pixels of
// the 1600-wide raster, per side. Its stems are ~51px there, so 10 takes about
// two fifths off them. This is a judgement call, not a measurement: by stroke
// width, ink density and Chrome's own resampling the art was already the
// lighter of the two rows, but it rasterises hard-edged and blocky at 7px
// where the sprite's text is soft, and that reads as weight.
const PHONE_ERODE = 10;
const phoneRaw = await sharp(readFileSync('scripts/assets/phone-label.svg'))
  .resize({ width: 1600 })
  .flatten({ background: '#ffffff' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const PW = phoneRaw.info.width, PH = phoneRaw.info.height;
// grey-on-white, the same space blackbox's ink is resized in — turning grey
// into alpha only after the downscale, or sharp erodes the strokes
const phonePng = new PNG({ width: PW, height: PH });
let px0 = PW, py0 = PH, px1 = -1, py1 = -1;
for (let i = 0; i < PW * PH; i++) {
  const v = Math.max(phoneRaw.data[i * 3], phoneRaw.data[i * 3 + 1], phoneRaw.data[i * 3 + 2]);
  phonePng.data[i * 4] = phonePng.data[i * 4 + 1] = phonePng.data[i * 4 + 2] = v;
  phonePng.data[i * 4 + 3] = 255;
  if (v < 240) {
    const x = i % PW, y = (i / PW) | 0;
    if (x < px0) px0 = x;
    if (x > px1) px1 = x;
    if (y < py0) py0 = y;
    if (y > py1) py1 = y;
  }
}
// Erode the ink — in grey-on-white that is a max filter, since lighter is less
// ink — over a round kernel, so the strokes thin evenly instead of squarely.
if (PHONE_ERODE > 0) {
  const src = Buffer.from(phonePng.data);
  const R = PHONE_ERODE;
  for (let y = py0; y <= py1; y++) {
    for (let x = px0; x <= px1; x++) {
      let m = 0;
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= PH) continue;
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue;
          const xx = x + dx;
          if (xx < 0 || xx >= PW) continue;
          const v = src[(yy * PW + xx) * 4];
          if (v > m) m = v;
        }
      }
      const o = (y * PW + x) * 4;
      phonePng.data[o] = phonePng.data[o + 1] = phonePng.data[o + 2] = m;
    }
  }
}

const phoneCrop = { left: px0, top: py0, width: px1 - px0 + 1, height: py1 - py0 + 1 };
const phoneSmall = await sharp(PNG.sync.write(phonePng))
  .extract(phoneCrop)
  .resize({ height: PHONE_INK_H })
  .sharpen({ sigma: 0.5 })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const SW = phoneSmall.info.width, SH = phoneSmall.info.height;
const phoneOut = new PNG({ width: SW, height: SH });
for (let i = 0; i < SW * SH; i++) {
  const cov = (255 - phoneSmall.data[i * 3]) / 255;
  phoneOut.data[i * 4] = phoneOut.data[i * 4 + 1] = phoneOut.data[i * 4 + 2] = 0;
  phoneOut.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.pow(cov, INK_GAMMA)));
}
await sharp(PNG.sync.write(phoneOut))
  .webp({ quality: 96, alphaQuality: 100 })
  .toFile('public/splash/phone-label.webp');
const EMAIL_LABEL_ASPECT = Number((SW / SH).toFixed(4));

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
// A content hash over everything just written. lib/splashFrames.ts hangs it on
// each asset URL: the frames all live at fixed paths and are rewritten in place
// by every rebuild, so without it a browser that has them cached will happily
// mix old frames with new ones — which looks exactly like a half-applied edit.
const stamp = createHash('sha1');
for (const f of readdirSync(OUT).sort()) stamp.update(readFileSync(`${OUT}/${f}`));
for (const f of ['edge', 'settle', 'blackbox', 'phone-label']) stamp.update(readFileSync(`public/splash/${f}.webp`));
const ASSET_V = stamp.digest('hex').slice(0, 8);

const edgeBuf = Buffer.concat(edgeProfiles.map((u) => Buffer.from(u)));
writeFileSync(
  'lib/splashEdgeProfile.ts',
  `// GENERATED by scripts/build-splash-frames.mjs — do not edit.\n` +
    `// ${edgeProfiles.length} frames x ${EBANDS} bands x 2 sides, one byte each.\n` +
    `export const SPLASH_EDGE_BANDS = ${EBANDS};\n` +
    `export const SPLASH_EDGE_B64 =\n  '${edgeBuf.toString('base64')}';\n` +
    `\n// Content hash of every baked asset — appended to their URLs so a rebuild\n` +
    `// is never served from a stale cache.\n` +
    `export const SPLASH_ASSET_V = '${ASSET_V}';\n` +
    `\n// Width/height of phone-label.webp once trimmed to its own ink, so the\n` +
    `// EMAIL row can size the artwork by height and let the width follow.\n` +
    `export const SPLASH_EMAIL_LABEL_ASPECT = ${EMAIL_LABEL_ASPECT};\n`,
);
console.log(`wrote ${written} frames + edge/settle/blackbox/phone-label.webp + lib/splashEdgeProfile.ts (${edgeBuf.length}B)`);
