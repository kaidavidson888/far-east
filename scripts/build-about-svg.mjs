/**
 * Normalises the Figma export for the About Us page.
 *
 *   npm run build:about
 *
 * Same treatment as the landing page, on a red ground instead of a white one.
 *
 * 1. The export's `<mask>` elements sit at the top level rather than in
 *    `<defs>`. A mask separated from the shape that uses it stops masking, so
 *    cutting the page into parts would turn the seal's mark and each footer
 *    icon into a solid white block. They are moved into `<defs>` first, where
 *    every part that references one can still reach it.
 *
 * 2. Colours that are a hair off the page's own red, or a hair off white, are
 *    snapped to exactly those. #FD0000 against #FF0000 is a difference of 2 in
 *    one channel — invisible, but enough to show as a seam where two shapes
 *    meet.
 *
 * 3. The top-left logo is a 2048x2048 PNG used as an alpha mask, 293KB and
 *    soft on a dense screen. It is swapped for the same mark as vector,
 *    recoloured for this page: the strokes become white, and the counters
 *    inside them become the page's red so they read as background.
 *
 * The two body-text blocks stay as the export drew them — they are raster in
 * the source, and re-typesetting them would be a different job from this one.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { splitIntoParts } from './lib/split-svg-parts.mjs';
import { resampleEmbedded } from './lib/resample-embedded.mjs';
import { substituteArtwork } from './lib/about-artwork.mjs';

const SRC = 'scripts/assets/about-mobile.svg';
const LOGO = 'scripts/assets/logo-characters.svg';
const OUT = '.artwork/about-mobile.svg';
const PARTS_DIR = 'public/about/parts';
const GEOMETRY = 'lib/about-geometry.json';

const BACKGROUND = '#ff0000';
const INK = '#ffffff';
const NEAR = 0x08; // channels this close to a reference colour count as it

const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const near = (colour, reference) => {
  const a = hex(colour);
  const b = hex(reference);
  if (!a || !b) return false;
  return a.every((v, i) => Math.abs(v - b[i]) <= NEAR);
};

/**
 * The vector logo, recoloured for a red page and placed on the raster's
 * footprint.
 *
 * Measured: the vector's ink sits at (686, 301) 675 x 1504 in its own 2048
 * box; the raster's lands at (43.75, 28) 38.5 x 85.25 on the page. Aspects
 * 0.4488 against 0.4516 — 0.6% apart — so the scale comes from the height and
 * the width is centred on the old box rather than stretched to it.
 *
 * VTracer emits an opaque full-canvas rectangle first; that one is dropped,
 * and asserted near-white so a retrace that reorders the paths fails loudly
 * instead of quietly losing a stroke. Of what remains, the dark paths are the
 * strokes and become the page's ink; the pale ones are the counters inside
 * them and become the page's ground.
 */
function logoGroup() {
  const svg = readFileSync(LOGO, 'utf8');
  const paths = svg.match(/<path\b[^>]*\/>/g) ?? [];
  if (!paths.length) throw new Error(`no paths in ${LOGO}`);
  const backdrop = /fill="([^"]+)"/.exec(paths[0])?.[1] ?? '';
  if (!near(backdrop, '#ffffff')) {
    throw new Error(`${LOGO}: expected a near-white backdrop first, got ${paths[0].slice(0, 60)}`);
  }

  const VECTOR = { x: 686, y: 301, w: 675, h: 1504 };
  const TARGET = { x: 43.75, y: 28, w: 38.5, h: 85.25 };
  const s = TARGET.h / VECTOR.h;
  const left = TARGET.x + TARGET.w / 2 - (VECTOR.w * s) / 2;
  const tx = left - VECTOR.x * s;
  const ty = TARGET.y - VECTOR.y * s;

  let strokes = 0;
  const body = paths
    .slice(1)
    .map((p) =>
      p.replace(/fill="([^"]+)"/, (whole, colour) => {
        if (near(colour, '#ffffff')) return `fill="${BACKGROUND}"`;
        strokes++;
        return `fill="${INK}"`;
      }),
    )
    // VTracer emits two decimals at 2048 scale; one whole unit there is 0.06px
    // on the page, so the fraction buys nothing and costs half the file.
    .map((p) => p.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n)))))
    .join('\n');
  if (!strokes) throw new Error(`${LOGO}: no dark strokes found to recolour`);

  return `<g transform="translate(${tx.toFixed(3)},${ty.toFixed(3)}) scale(${s.toFixed(7)})">\n${body}\n</g>`;
}

const src = readFileSync(SRC, 'utf8');

// 1. masks into defs, so a part can be cut out without losing its mask
const masks = src.match(/<mask id="[^"]+"[\s\S]*?<\/mask>/g) ?? [];
if (!masks.length) throw new Error('expected top-level <mask> elements');
let staged = masks.reduce((acc, m) => acc.replace(m, ''), src);
staged = staged.replace('<defs>', `<defs>\n${masks.join('\n')}`);
if (!staged.includes('<defs>')) throw new Error('no <defs> to move the masks into');

// 2. the raster logo out, the vector in, and the defs it needed with it
const LOGO_MASK = 'mask3_128_795';
const logoUse = new RegExp(`<g mask="url\\(#${LOGO_MASK}\\)">[\\s\\S]*?<\\/g>`);
if (!logoUse.test(staged)) throw new Error('the raster logo group was not where it was expected');
staged = staged.replace(logoUse, logoGroup());
staged = staged
  .replace(new RegExp(`<mask id="${LOGO_MASK}"[\\s\\S]*?<\\/mask>`), '')
  .replace(/<pattern id="pattern4_128_795"[\s\S]*?<\/pattern>/, '')
  .replace(/<image id="image4_128_795"[^>]*\/>/, '');

// 3. snap the near-misses to the page's own two colours
const seen = new Map();
const snap = (whole, attr, colour) => {
  const target = near(colour, BACKGROUND) ? BACKGROUND : near(colour, INK) ? INK : null;
  if (!target || colour.toLowerCase() === target) return whole;
  seen.set(`${colour} -> ${target}`, (seen.get(`${colour} -> ${target}`) ?? 0) + 1);
  return `${attr}="${target}"`;
};
const snapped = staged
  .replace(/fill="([^"]+)"/g, (w, c) => snap(w, 'fill', c))
  .replace(/stroke="([^"]+)"/g, (w, c) => snap(w, 'stroke', c));

// 4. bring the embedded rasters down to the size they are actually drawn at
const { svg: out, report } = await resampleEmbedded(snapped);

mkdirSync('.artwork', { recursive: true });
writeFileSync(OUT, out);

for (const [change, n] of seen) console.log(`snapped ${change} x${n}`);
for (const r of report) {
  console.log(
    `resampled ${r.imageId}: ${r.from} -> ${r.to} (drawn at ${r.drawnAt}, was ${r.wasOversampled} oversampled, saved ${r.savedKB}KB)`,
  );
}
console.log(`wrote ${OUT} (${Math.round(out.length / 1024)}KB)`);

/**
 * Where each element lives, in artwork coordinates. Nodes are grouped by the
 * region they sit in rather than by index, so a re-export that reorders the
 * document still lands each mark in the right part.
 */
const REGIONS = {
  logo: { x0: 0, x1: 110, y0: 0, y1: 140 },
  seal: { x0: 250, x1: 390, y0: 0, y1: 100 },
  intro: { x0: 0, x1: 390, y0: 140, y1: 380 },
  focus: { x0: 0, x1: 390, y0: 380, y1: 660 },
  navAbout: { x0: 60, x1: 160, y0: 700, y1: 820 },
  navTerms: { x0: 160, x1: 235, y0: 700, y1: 820 },
  navPrivacy: { x0: 235, x1: 330, y0: 700, y1: 820 },
};

console.log('\nper-element parts:');
const geometry = await splitIntoParts(out, {
  outDir: PARTS_DIR,
  geometryFile: GEOMETRY,
  regions: REGIONS,
  background: BACKGROUND,
  contrast: INK,
});

// The export drew the body text and the footer buttons as bitmaps. The Our
// Focus bitmap has its last line's descenders clipped by the box border, and
// the buttons soften under any re-encode, so both come from the supplied
//
// artwork instead. Re-measure where each lands so the layout follows the
// replacements rather than the originals. See scripts/lib/about-artwork.mjs.
console.log('\nsubstituted artwork:');
const log = await substituteArtwork({
  bodyTextFile: 'scripts/assets/about/body-text.svg',
  navFiles: {
    navAbout: 'scripts/assets/about/nav-about-black.svg',
    navTerms: 'scripts/assets/about/nav-terms.svg',
    navPrivacy: 'scripts/assets/about/nav-privacy.svg',
  },
  partsDir: PARTS_DIR,
  page: { w: 390, h: 844 },
  background: BACKGROUND,
  geometry,
});
for (const line of log) console.log(`  ${line}`);

writeFileSync(
  GEOMETRY,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:about — do not edit by hand.',
      viewBox: { w: 390, h: 844 },
      background: BACKGROUND,
      parts: geometry,
    },
    null,
    2,
  )}\n`,
);
console.log(`rewrote ${GEOMETRY} with the substituted boxes`);
