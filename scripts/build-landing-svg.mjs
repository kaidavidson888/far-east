/**
 * Normalises the Figma export for the landing page.
 *
 *   npm run build:landing
 *
 * The export paints its whites as a dozen slightly different values — #FEFEFE,
 * #FDFDFD, #FAFAF9, #E7E5E4 and so on, plus four opaque white backing rects
 * behind the seal, "My Saved" and "TEST YOUR LUCK". On a white artboard they
 * are invisible; on anything else they show as faint plates and edges. Every
 * one of them is flattened to a single BACKGROUND, which the page then uses as
 * its own background so nothing can seam.
 *
 * "Near-white" is judged on the colour, not the spelling: every channel at
 * least MIN_CHANNEL and a chroma no wider than MAX_CHROMA. That keeps the
 * seal's #FD0000 red — which also starts with an F — well clear.
 *
 * It also swaps the top-left logo. The export draws it as a 2048x2048 JPEG
 * scaled into a 116x116 rect: ~2MB of the 2.05MB file, soft on any dense
 * screen, and carrying a baked-in off-white plate that no fill rewrite can
 * reach. LOGO is the same mark as vector, dropped in at a transform that puts
 * its ink exactly where the raster's was, and the pattern and image defs go
 * with it.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { splitIntoParts } from './lib/split-landing-parts.mjs';

const SRC = 'scripts/assets/landing-mobile.svg';
const PARTS_DIR = 'public/landing/parts';
const GEOMETRY = 'lib/landing-geometry.json';
const LOGO = 'scripts/assets/logo-characters.svg';
const OUT = 'public/landing/landing-mobile.svg';
const BACKGROUND = '#ffffff';
const MIN_CHANNEL = 0xe0; // 224
const MAX_CHROMA = 0x12; // 18

const hex = (c) => {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const isNearWhite = (c) => {
  if (c.toLowerCase() === 'white') return true;
  const rgb = hex(c);
  if (!rgb) return false;
  const min = Math.min(...rgb);
  const chroma = Math.max(...rgb) - min;
  return min >= MIN_CHANNEL && chroma <= MAX_CHROMA;
};

/**
 * The vector logo's paths, placed so its ink lands on the raster's footprint.
 *
 * Measured: the vector's ink sits at (688, 300) 672 x 1504 in its own 2048
 * box; the raster's landed at (46, 28) 38 x 86 on the page. Their aspects are
 * 0.4468 against 0.4419 — 1% apart — so the scale comes from the height and
 * the width is centred on the old box rather than stretched to it.
 *
 * VTracer emits an opaque full-canvas rectangle first; that one is dropped.
 * The near-white shapes after it are the counters inside the strokes and are
 * kept, flattened like everything else so they read as background.
 */
function logoGroup() {
  const svg = readFileSync(LOGO, 'utf8');
  const paths = svg.match(/<path\b[^>]*\/>/g) ?? [];
  if (!paths.length) throw new Error(`no paths in ${LOGO}`);
  if (!isNearWhite(/fill="([^"]+)"/.exec(paths[0])?.[1] ?? '')) {
    throw new Error(`${LOGO}: expected a near-white backdrop first, got ${paths[0].slice(0, 60)}`);
  }

  const INK = { x: 688, y: 300, w: 672, h: 1504 };
  const TARGET = { x: 46, y: 28, w: 38, h: 86 };
  const s = TARGET.h / INK.h;
  const left = TARGET.x + TARGET.w / 2 - (INK.w * s) / 2;
  const tx = left - INK.x * s;
  const ty = TARGET.y - INK.y * s;

  // VTracer emits two decimals at 2048 scale. One unit there is 0.057px on the
  // page, so the fraction is worth about a thousandth of a pixel and costs half
  // the file. Round the coordinates to whole units.
  const body = paths
    .slice(1)
    .map((p) => p.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n)))))
    .join('\n');
  return `<g transform="translate(${tx.toFixed(3)},${ty.toFixed(3)}) scale(${s.toFixed(7)})">\n${body}\n</g>`;
}

const src = readFileSync(SRC, 'utf8');
// swap the raster logo for the vector, and drop the defs it needed
let staged = src.replace(
  /<rect x="7" y="11" width="116" height="116" fill="url\(#pattern0_87_99\)"\/>/,
  logoGroup(),
);
if (staged === src) throw new Error('the logo rect was not where it was expected');
staged = staged
  .replace(/<pattern id="pattern0_87_99"[\s\S]*?<\/pattern>/, '')
  .replace(/<image id="image0_87_99"[^>]*\/>/, '');

const seen = new Map();
const out = staged.replace(/fill="([^"]+)"/g, (whole, colour) => {
  if (!isNearWhite(colour)) return whole;
  seen.set(colour, (seen.get(colour) ?? 0) + 1);
  return `fill="${BACKGROUND}"`;
});

// The ☁ is two traced paths carrying three decimals each, ~450KB of the file
// on its own. The artwork is laid out at 390 wide, so a thousandth of a unit is
// a thousandth of a pixel. Two decimals are still finer than any screen, and only
// path data is touched, never a transform — the logo's scale factor is 0.057
// and rounding that would flatten it.
const trimmed = out.replace(/ d="([^"]+)"/g, (whole, d) =>
  ` d="${d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 100) / 100))}"`,
);

mkdirSync('public/landing', { recursive: true });
writeFileSync(OUT, trimmed);

const total = [...seen.values()].reduce((a, b) => a + b, 0);
console.log(`flattened ${total} near-white fills to ${BACKGROUND}:`);
for (const [c, n] of [...seen].sort((a, b) => b[1] - a[1])) console.log(`  ${c} x${n}`);
console.log(`wrote ${OUT}`);

console.log('\nper-element parts:');
await splitIntoParts(trimmed, { outDir: PARTS_DIR, geometryFile: GEOMETRY });
