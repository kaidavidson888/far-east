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
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SRC = 'scripts/assets/landing-mobile.svg';
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

const src = readFileSync(SRC, 'utf8');
const seen = new Map();
const out = src.replace(/fill="([^"]+)"/g, (whole, colour) => {
  if (!isNearWhite(colour)) return whole;
  seen.set(colour, (seen.get(colour) ?? 0) + 1);
  return `fill="${BACKGROUND}"`;
});

mkdirSync('public/landing', { recursive: true });
writeFileSync(OUT, out);

const total = [...seen.values()].reduce((a, b) => a + b, 0);
console.log(`flattened ${total} near-white fills to ${BACKGROUND}:`);
for (const [c, n] of [...seen].sort((a, b) => b[1] - a[1])) console.log(`  ${c} x${n}`);
console.log(`wrote ${OUT}`);
