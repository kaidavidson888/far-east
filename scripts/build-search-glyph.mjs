/**
 * Cuts the owner's spiral glass into the row's SEARCH mark.
 *
 *   npm run build:searchglyph
 *
 * The owner's 2026-09-19 ask: "turn this image into a magnifying glass icon
 * that is the same style as the + button. Make it the same size". The image
 * (scripts/assets/search-glass.jpg) is a disc with three spirals cut out of it
 * and a curling tail — a magnifying glass already, lens and handle — so what
 * "turn it into an icon" means is what it meant for the plus and the minus:
 * a vector that can be DRAWN INLINE AND FILLED WITH currentColor, because the
 * button it sits in inverts under the pointer and an <img> cannot follow it
 * (lib/cigToggleGlyph.ts says the same of the other two).
 *
 * IT IS TRACED, since the owner supplied a picture rather than a vector:
 * the image is thresholded, its boundaries walked by marching squares, and
 * each loop thinned with Douglas-Peucker. They are written as straight
 * segments, not fitted curves — the mark is drawn about 75 times smaller than
 * it is traced, so a vertex every couple of source px is far finer than any
 * screen will show, and a polygon has no fitting to get wrong. Holes need no
 * bookkeeping: the path is filled EVEN-ODD, so a loop inside a loop is a hole.
 *
 * THE WHITE IS OPENED UP BEFORE TRACING (`OPEN`). The spirals' cuts are about
 * 3% of the mark's width — a third of a pixel at the size the row draws it —
 * and a browser antialiases a cut that thin into grey, so the lens arrives as a
 * mottled disc. Taking a little off the black widens the cuts so that they
 * survive the reduction, the same reason the 發 tile is sharpened per density.
 * What comes through at 21px is a ring with a pale three-armed centre,
 * which reads as a lens — and the plus beside it is a pinwheel too.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/search-glass.jpg';
const OUT = 'lib/searchGlyph.ts';

/** The trace's own resolution: the mark's long side, in px. */
const TRACE = 1200;
/** How much black comes off every edge before tracing, in trace px. */
const OPEN = Number(process.env.GLYPH_OPEN ?? 12);
/** Douglas-Peucker tolerance, in trace px. */
const EPS = 1.6;
/** The mark's long side as drawn, in the button's px: the plus's own 16. */
const MARK = 16;
/** Loops smaller than this are jpeg speckle, not drawing (trace px of area). */
const MIN_AREA = 60;

const fail = (m) => {
  throw new Error(`build-search-glyph: ${m}`);
};

// ---- the mask -------------------------------------------------------------
const meta = await sharp(SRC).metadata();
const scale = TRACE / Math.max(meta.width, meta.height);
const W0 = Math.round(meta.width * scale), H0 = Math.round(meta.height * scale);
const { data: grey } = await sharp(SRC).resize({ width: W0, height: H0, fit: 'fill' }).greyscale().raw().toBuffer({ resolveWithObject: true });

// a white border all round, so a mark that touches the picture's edge (this
// one does, on all four sides) still closes its loops
const PAD = OPEN + 4;
const W = W0 + PAD * 2, H = H0 + PAD * 2;
let ink = new Uint8Array(W * H);
for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) ink[(y + PAD) * W + x + PAD] = grey[y * W0 + x] < 128 ? 1 : 0;

/** Erode the ink by r px: a real disc, by distance to the nearest white. */
function erode(m, r) {
  if (r <= 0) return m;
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = m[i] ? INF : 0;
  const D2 = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let v = d[i];
    if (y > 0) { if (x > 0) v = Math.min(v, d[i - W - 1] + D2); v = Math.min(v, d[i - W] + 1); if (x < W - 1) v = Math.min(v, d[i - W + 1] + D2); }
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    let v = d[i];
    if (y < H - 1) { if (x < W - 1) v = Math.min(v, d[i + W + 1] + D2); v = Math.min(v, d[i + W] + 1); if (x > 0) v = Math.min(v, d[i + W - 1] + D2); }
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
    d[i] = v;
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = d[i] > r ? 1 : 0;
  return out;
}
const before = ink.reduce((a, b) => a + b, 0);
ink = erode(ink, OPEN);
const after = ink.reduce((a, b) => a + b, 0);

// ---- marching squares -----------------------------------------------------
/*
 * Each cell is the square between four samples. An edge of the boundary runs
 * through a cell wherever its samples disagree; walking from edge to edge
 * closes a loop. The two saddle cases (5 and 10) are read as INK joined, so a
 * diagonal pair of ink samples stays one shape rather than splitting.
 */
const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : ink[y * W + x]);
// for a cell at (x,y): bit 8 = top-left, 4 = top-right, 2 = bottom-right, 1 = bottom-left
const caseOf = (x, y) => (at(x, y) << 3) | (at(x + 1, y) << 2) | (at(x + 1, y + 1) << 1) | at(x, y + 1);
// edges: 0 top, 1 right, 2 bottom, 3 left; the midpoint of each
const mid = (x, y, e) => (e === 0 ? [x + 0.5, y] : e === 1 ? [x + 1, y + 0.5] : e === 2 ? [x + 0.5, y + 1] : [x, y + 0.5]);
// for each case, the edge pairs the boundary joins (ink kept on the left)
const SEG = {
  1: [[3, 2]], 2: [[2, 1]], 3: [[3, 1]], 4: [[1, 0]], 5: [[3, 0], [1, 2]], 6: [[2, 0]], 7: [[3, 0]],
  8: [[0, 3]], 9: [[0, 2]], 10: [[0, 1], [2, 3]], 11: [[0, 1]], 12: [[1, 3]], 13: [[1, 2]], 14: [[2, 3]],
};
const key = (x, y, e) => `${x},${y},${e}`;
// an edge is shared by two cells; name it once
const canon = (x, y, e) => (e === 2 ? key(x, y + 1, 0) : e === 1 ? key(x + 1, y, 3) : key(x, y, e));
const next = new Map(); // from a canonical edge to the one the boundary goes on to
const pos = new Map();
for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) {
  const segs = SEG[caseOf(x, y)];
  if (!segs) continue;
  for (const [a, b] of segs) {
    const ka = canon(x, y, a), kb = canon(x, y, b);
    next.set(ka, kb);
    pos.set(ka, mid(x, y, a));
    pos.set(kb, mid(x, y, b));
  }
}
const loops = [];
const seen = new Set();
for (const start of next.keys()) {
  if (seen.has(start)) continue;
  const pts = [];
  let k = start;
  while (k && !seen.has(k)) {
    seen.add(k);
    pts.push(pos.get(k));
    k = next.get(k);
  }
  if (k !== start) continue; // an open run cannot happen inside the white border
  loops.push(pts);
}

// ---- thinning --------------------------------------------------------------
const areaOf = (p) => {
  let a = 0;
  for (let i = 0; i < p.length; i++) { const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % p.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
};
function simplify(p, eps) {
  if (p.length < 8) return p;
  // open it at its two furthest-apart points, thin each half, and close it again
  let far = 0, best = -1;
  for (let i = 1; i < p.length; i++) { const d = (p[i][0] - p[0][0]) ** 2 + (p[i][1] - p[0][1]) ** 2; if (d > best) { best = d; far = i; } }
  const dp = (a) => {
    const keep = new Uint8Array(a.length); keep[0] = keep[a.length - 1] = 1;
    const stack = [[0, a.length - 1]];
    while (stack.length) {
      const [i, j] = stack.pop();
      const [ax, ay] = a[i], [bx, by] = a[j];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
      let m = -1, md = eps;
      for (let t = i + 1; t < j; t++) { const d = Math.abs((a[t][0] - ax) * dy - (a[t][1] - ay) * dx) / L; if (d > md) { md = d; m = t; } }
      if (m > 0) { keep[m] = 1; stack.push([i, m], [m, j]); }
    }
    return a.filter((_, t) => keep[t]);
  };
  const h1 = dp(p.slice(0, far + 1)), h2 = dp([...p.slice(far), p[0]]);
  return [...h1.slice(0, -1), ...h2.slice(0, -1)];
}
const kept = loops.filter((p) => Math.abs(areaOf(p)) >= MIN_AREA).map((p) => simplify(p, EPS));
if (!kept.length) fail('nothing was traced');

// ---- the mark's own box, and the path --------------------------------------
let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
for (const p of kept) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
const bw = x1 - x0, bh = y1 - y0;
// into a box 100 units across its long side: two decimals there is a fortieth
// of a source px, and the numbers stay short
const U = 100 / Math.max(bw, bh);
const n2 = (v) => +v.toFixed(2);
const d = kept
  .map((p) => `M${p.map(([x, y]) => `${n2((x - x0) * U)} ${n2((y - y0) * U)}`).join('L')}Z`)
  .join('');
const VW = n2(bw * U), VH = n2(bh * U);
const pointCount = kept.reduce((s, p) => s + p.length, 0);

writeFileSync(
  OUT,
  `/**
 * THE SEARCH MARK — the owner's spiral glass, traced. Generated by
 * \`npm run build:searchglyph\` from scripts/assets/search-glass.jpg; do not edit
 * by hand. Drawn inline and filled with \`currentColor\`, EVEN-ODD, so that it
 * inverts with its button the way the plus and the minus do
 * (lib/cigToggleGlyph.ts) — an <img> could not.
 *
 * ${kept.length} loops, ${pointCount} points, ${d.length} bytes of path.
 */
import type { CigGlyph } from './cigToggleGlyph';

/**
 * SIZED BY THE PLUS'S OWN RULE ("make it the same size"): the plus takes 16
 * of the 26px its button's rule leaves, 5 clear on every side. This mark is
 * wider than it is tall, so its LONG side is the 16 and the other follows.
 */
export const SEARCH_GLYPH: CigGlyph = {
  viewBox: '0 0 ${VW} ${VH}',
  transform: '',
  d: '${d}',
  fillRule: 'evenodd',
  width: ${MARK},
  height: ${n2((MARK * VH) / VW)},
};
`,
);

console.log(`${SRC}: ${meta.width}x${meta.height}, traced at ${W0}x${H0}`);
console.log(`  opened by ${OPEN}px: ink ${before} -> ${after} (${((100 * after) / before).toFixed(1)}%)`);
console.log(`  ${loops.length} loops walked, ${kept.length} kept, ${pointCount} points, ${d.length} bytes of path`);
console.log(`  the mark is ${VW} x ${VH} units (${(bw / bh).toFixed(3)} wide for its height)`);
console.log(`wrote ${OUT}`);

// ---- for looking at ---------------------------------------------------------
if (process.env.GLYPH_PREVIEW) {
  mkdirSync('.tmp', { recursive: true });
  const svg = (size, fg, bg) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="${bg}"/>` +
    `<g transform="translate(${(size - (VW * size * 0.62) / Math.max(VW, VH)) / 2} ${(size - (VH * size * 0.62) / Math.max(VW, VH)) / 2}) scale(${(size * 0.62) / Math.max(VW, VH)})"><path d="${d}" fill="${fg}" fill-rule="evenodd"/></g></svg>`;
  const tiles = [];
  for (const px of [21, 30, 60]) {
    for (const [fg, bg] of [['#010101', '#ffffff'], ['#ffffff', '#010101']]) {
      const small = await sharp(Buffer.from(svg(px * 4, fg, bg))).resize({ width: px, kernel: 'lanczos3' }).png().toBuffer();
      tiles.push(await sharp(small).resize({ width: 240, kernel: 'nearest' }).png().toBuffer());
    }
  }
  await sharp({ create: { width: 250 * tiles.length, height: 240, channels: 3, background: '#cccccc' } })
    .composite(tiles.map((t, i) => ({ input: t, left: i * 250 + 5, top: 0 })))
    .png()
    .toFile(`.tmp/search-glyph-open${OPEN}.png`);
  console.log(`  GLYPH_PREVIEW: wrote .tmp/search-glyph-open${OPEN}.png (the button at 21 / 30 / 60 px, each both ways round)`);
}
