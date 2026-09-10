/**
 * Bakes the seal animation.
 *
 *   npm run build:seal
 *
 * The seal mark fills with red cloud filigree and then inverts to a black
 * ground. As with the logo menu, the source is a GIF and a GIF cannot be
 * seeked, paused or run backwards, so its frames are baked out for a canvas
 * to scrub.
 *
 * SIZE. The seal is drawn as a square the height of the character logo, so
 * the frames are baked at twice the largest of those — 87 -> 174 — which is
 * what a dense screen can use.
 *
 * COLOUR. The seal is an opaque square that sits on the page's own ground:
 * white on the landing page, red on the three inner pages. So its white has
 * to be the page's white and its red the page's red, exactly, or the square
 * shows as a patch. Two things were in the way.
 *
 *   1. The GIF's own palette is off: its white is 254,251,251 and its sky red
 *      253,0,0. Both are snapped to the page's colours before anything else.
 *   2. A lossy encode will not keep a flat field flat. At q60 a single frame
 *      came back with 1405 distinct colours and only some of the white still
 *      pure — the ground shimmered frame to frame.
 *
 * So the frames are quantised to a fixed palette built from the four colours
 * the artwork actually uses, plus an even ramp between each pair for the
 * anti-aliased edges, and written lossless. Nothing an encoder chooses can
 * drift: white is #ffffff in every frame. It is also cheaper than the lossy
 * bake it replaces — 46 colours compress far better than 15,000 — so this
 * costs nothing to buy.
 *
 * Note the palette must be fixed rather than chosen per frame. libimagequant
 * picks representative colours by frequency, and on the middle frames, where
 * filigree has eaten most of the ground, it settles the white on 255,253,253
 * and the black on 2,0,0 — which is the same defect by another route.
 *
 * SPEED. Played at the GIF's own rate the run takes 9.3s, which is a long
 * time to hold a hover. `SPEED` divides the frame time; the reverse is faster
 * again on top of this (see useFrameScrub's reverseRate).
 *
 * The mark keeps its own square, so the animation lands on the seal's own
 * corner on every page: 30 from the right edge, 24 from the top. On the
 * landing page the page's own seal part is only the top 24px, because the
 * lower half is white mountain on a white ground and the build crops parts to
 * their ink; the animation's first frame has that same white lower half, so
 * it still lines up.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/seal-button.gif';
const FRAMES_DIR = 'public/seal/frames';
const GEOMETRY = 'lib/seal-geometry.json';

/** Drawn size on the page, and the backing scale. */
// the seal is drawn as a square the height of the character logo; 87 is the
// largest of those across the pages, so no page has to upscale
const DRAWN = 87;
const SS = 2;

/** How much faster than the source GIF it plays. */
const SPEED = 2.5;

/** Where the seal sits, measured off the artwork: right margin and top. */
const PLACEMENT = { right: 30, top: 24, w: DRAWN, h: DRAWN };

/** The GIF's palette, and what the page calls the same colour. */
const SNAP = [
  { from: [254, 251, 251], to: [255, 255, 255] }, // ground -> the landing page's white
  { from: [253, 0, 0], to: [255, 0, 0] }, // sky -> the inner pages' red
];
const SNAP_TOLERANCE = 6;

/** The colours the artwork is made of, after snapping. */
const BASE = [
  [255, 255, 255], // ground
  [255, 0, 0], // sky
  [0, 0, 0], // peak
  [252, 49, 49], // filigree
];
/** Steps of the ramp laid between each pair, for anti-aliased edges. */
const RAMP = 8;

function buildPalette() {
  const out = BASE.map((c) => c.slice());
  const seen = new Set(out.map((c) => c.join(',')));
  for (let a = 0; a < BASE.length; a++) {
    for (let b = a + 1; b < BASE.length; b++) {
      for (let s = 1; s < RAMP; s++) {
        const t = s / RAMP;
        const c = [0, 1, 2].map((k) => Math.round(BASE[a][k] * (1 - t) + BASE[b][k] * t));
        const key = c.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(c);
      }
    }
  }
  return out;
}

const PALETTE = buildPalette();

/** Nearest palette colour, memoised — a frame holds only a few thousand. */
function quantise(px) {
  const cache = new Map();
  for (let p = 0; p < px.length; p += 3) {
    const key = (px[p] << 16) | (px[p + 1] << 8) | px[p + 2];
    let c = cache.get(key);
    if (!c) {
      let best = PALETTE[0];
      let bestD = Infinity;
      for (const q of PALETTE) {
        const d = (q[0] - px[p]) ** 2 + (q[1] - px[p + 1]) ** 2 + (q[2] - px[p + 2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      c = best;
      cache.set(key, c);
    }
    px[p] = c[0];
    px[p + 1] = c[1];
    px[p + 2] = c[2];
  }
  return px;
}

const buf = readFileSync(SRC);
const meta = await sharp(buf, { animated: true }).metadata();
const N = meta.pages;
const delays = meta.delay ?? [];
const sourceMs = delays.length
  ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length)
  : 50;
const frameMs = Math.max(1, Math.round(sourceMs / SPEED));

console.log(
  `${SRC}: ${meta.width}x${meta.pageHeight}, ${N} frames, ~${sourceMs}ms each ` +
    `(${((N * sourceMs) / 1000).toFixed(2)}s) -> ${frameMs}ms at ${SPEED}x ` +
    `(${((N * frameMs) / 1000).toFixed(2)}s)`,
);
console.log(`palette: ${PALETTE.length} colours`);

rmSync(FRAMES_DIR, { recursive: true, force: true });
mkdirSync(FRAMES_DIR, { recursive: true });

let total = 0;
for (let i = 0; i < N; i++) {
  // snap the GIF's palette to the page's colours before resampling, so the
  // anti-aliased edges are blends of the right colours rather than the wrong
  const src = await sharp(buf, { page: i })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { data, info } = src;
  for (let p = 0; p < data.length; p += 3) {
    for (const { from, to } of SNAP) {
      if (
        Math.abs(data[p] - from[0]) <= SNAP_TOLERANCE &&
        Math.abs(data[p + 1] - from[1]) <= SNAP_TOLERANCE &&
        Math.abs(data[p + 2] - from[2]) <= SNAP_TOLERANCE
      ) {
        data[p] = to[0];
        data[p + 1] = to[1];
        data[p + 2] = to[2];
        break;
      }
    }
  }

  const resized = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 3 },
  })
    .resize({ width: DRAWN * SS, height: DRAWN * SS, fit: 'fill' })
    .raw()
    .toBuffer();

  const out = await sharp(quantise(resized), {
    raw: { width: DRAWN * SS, height: DRAWN * SS, channels: 3 },
  })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(`${FRAMES_DIR}/f${String(i).padStart(3, '0')}.webp`, out);
  total += out.length;
}
console.log(`wrote ${N} frames to ${FRAMES_DIR} (${Math.round(total / 1024)}KB)`);

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:seal — do not edit by hand.',
      frames: N,
      frameMs,
      sourceMs,
      speed: SPEED,
      scale: SS,
      placement: PLACEMENT,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${GEOMETRY}`);
