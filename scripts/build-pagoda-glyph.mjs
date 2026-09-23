/**
 * Cuts the owner's pagoda into the corner button's mark.
 *
 *   npm run build:pagodaglyph
 *
 * The owner's 2026-09-23 ask, with the drawing attached: "Turn the art that i
 * attached into a simple button without the circle background make it black
 * with an outline box make it the same scale as the character buttons and put
 * it in the top right corner with 10Px margins from the edge. have the button
 * go to the shelf and fill black and turn lines red on hover and click".
 *
 * THE DRAWING IS A NEGATIVE AND THAT IS THE WHOLE TRICK. It is a dark disc
 * with the pagoda CUT OUT of it in the page's own cream — so the ink of the
 * mark is the LIGHT pixels, and only the light ones that are inside the disc.
 * `inkMask` in scripts/lib/trace-mark.mjs takes dark for ink, which here
 * would trace the disc with pagoda-shaped holes in it: the circle the owner
 * asked to be rid of, and nothing else.
 *
 * So the strokes are found by asking which light pixels the page cannot reach:
 * flood the light from the image's border and what it does not touch is
 * enclosed by the disc, which is the drawing. No threshold on "how dark is the
 * circle" and no guess at where its edge is — the disc is simply whatever
 * separates the two. THE DRAWING IS NOT ONE CONNECTED SHAPE and nothing here
 * requires it to be: it is nine pieces (the roofs, the plinth, the finial and
 * its ring, the three tier diamonds), which is why there is no connectivity
 * check to lean on.
 *
 * Everything after that is the glass's and the dots' own path: marching
 * squares, Douglas-Peucker, one EVEN-ODD path filled with `currentColor` —
 * because the button fills black under the pointer and its lines go red, and
 * an <img> cannot follow a colour it is given.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { contours, loopArea, simplify, toPath } from './lib/trace-mark.mjs';

const SRC = 'scripts/assets/pagoda.png';
const OUT = 'lib/pagodaGlyph.ts';

/** The trace's own resolution: the drawing's long side, in px. */
const TRACE = 1200;
/**
 * THE MARK'S LONG SIDE AS DRAWN, in the button's px. The character cells hold
 * a 27px mark in the 29px their 2px rule leaves — a pixel of air all round —
 * and "the same scale as the character buttons" is that box and that mark.
 */
const MARK = 27;
/** Douglas-Peucker tolerance, in trace px. */
const EPS = Number(process.env.GLYPH_EPS ?? 1.4);
/** Loops smaller than this are speckle, not drawing (trace px of area). */
const MIN_AREA = Number(process.env.GLYPH_MIN_AREA ?? 40);

const fail = (m) => {
  throw new Error(`build-pagoda-glyph: ${m}`);
};

// ---- the drawing, as the light inside the disc -----------------------------
const meta = await sharp(SRC).metadata();
const scale = TRACE / Math.max(meta.width, meta.height);
const W0 = Math.round(meta.width * scale);
const H0 = Math.round(meta.height * scale);
const { data: grey } = await sharp(SRC)
  .resize({ width: W0, height: H0, fit: 'fill' })
  .flatten({ background: '#ffffff' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
console.log(`${SRC}: ${meta.width}x${meta.height}, traced at ${W0}x${H0}`);

/**
 * Halfway between the two levels the drawing actually uses, not a fixed 128.
 * The disc is a warm brown and the paper an off-white; Otsu on this histogram
 * is one clean valley, and stating the two means the build can say what it
 * found rather than assuming.
 */
const THRESH = (() => {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < W0 * H0; i++) hist[grey[i]]++;
  let best = 128; let bestVar = -1;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let wB = 0; let sumB = 0;
  const total = W0 * H0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB; const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > bestVar) { bestVar = v; best = t; }
  }
  return best;
})();
const dark = new Uint8Array(W0 * H0);
for (let i = 0; i < W0 * H0; i++) dark[i] = grey[i] < THRESH ? 1 : 0;
const darkN = dark.reduce((a, b) => a + b, 0);
console.log(`  the split is at ${THRESH}; ${((100 * darkN) / (W0 * H0)).toFixed(1)}% of it is the disc`);
if (darkN < 0.1 * W0 * H0 || darkN > 0.9 * W0 * H0) fail('the drawing is not a dark shape on a light page');

/** The light the page can reach, from the border inwards. */
const outside = new Uint8Array(W0 * H0);
{
  const q = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W0 || y >= H0) return;
    const i = y * W0 + x;
    if (outside[i] || dark[i]) return;
    outside[i] = 1; q.push(i);
  };
  for (let x = 0; x < W0; x++) { push(x, 0); push(x, H0 - 1); }
  for (let y = 0; y < H0; y++) { push(0, y); push(W0 - 1, y); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h]; const x = i % W0; const y = (i / W0) | 0;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }
}

/** The drawing: light, and walled in by the disc. */
const ink = new Uint8Array(W0 * H0);
let n = 0;
for (let i = 0; i < W0 * H0; i++) {
  if (!dark[i] && !outside[i]) { ink[i] = 1; n++; }
}
if (!n) fail('nothing is enclosed by the disc — is the drawing a negative at all?');
let x0 = 1e9; let y0 = 1e9; let x1 = -1; let y1 = -1;
for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
  if (!ink[y * W0 + x]) continue;
  if (x < x0) x0 = x; if (x > x1) x1 = x;
  if (y < y0) y0 = y; if (y > y1) y1 = y;
}
const iw = x1 - x0 + 1; const ih = y1 - y0 + 1;
console.log(`  the drawing inside it: ${iw}x${ih} at ${x0},${y0} — ${n} px, ${((100 * n) / (iw * ih)).toFixed(1)}% of its own box`);
if (iw < 0.2 * W0 && ih < 0.2 * H0) fail(`what was found is ${iw}x${ih}: too small to be the drawing`);

/**
 * IT MUST NOT BE PRESSED UP AGAINST THE DISC. If the drawing touched that
 * edge the flood would reach round it and take part of the drawing with it,
 * and what is traced would be a fragment.
 *
 * WHAT THIS MEASURES IS TWO BOUNDING BOXES, NOT THE WALL OF DISC BETWEEN
 * THEM, and that is worth knowing before trusting the number. The dark bbox
 * is the SQUARE CIRCUMSCRIBING the disc, so this reads 77px where the
 * narrowest real wall — on the disc's diagonal — is 24. It is a cheap sanity
 * check that the drawing is not running out to the frame; it is NOT a proof
 * that no leak happened, and it cannot be made into one — a leak that removes
 * the TOP of the drawing moves the ink bbox away from the dark bbox and makes
 * this number go UP. What would catch a leak is the eye on GLYPH_PREVIEW.
 */
{
  let dx0 = 1e9; let dy0 = 1e9; let dx1 = -1; let dy1 = -1;
  for (let y = 0; y < H0; y++) for (let x = 0; x < W0; x++) {
    if (!dark[y * W0 + x]) continue;
    if (x < dx0) dx0 = x; if (x > dx1) dx1 = x;
    if (y < dy0) dy0 = y; if (y > dy1) dy1 = y;
  }
  const clear = Math.min(x0 - dx0, dx1 - x1, y0 - dy0, dy1 - y1);
  console.log(`  it stands ${clear}px clear of the disc at its tightest`);
  if (clear < 4) fail('the drawing touches the disc; the flood may have leaked round it');
}

// ---- the path --------------------------------------------------------------
const PAD = 2;
const W = iw + PAD * 2; const H = ih + PAD * 2;
const m = new Uint8Array(W * H);
for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
  m[(y + PAD) * W + x + PAD] = ink[(y0 + y) * W0 + x0 + x];
}
/*
 * MIN_AREA HAS TO ANSWER FOR WHAT IT THREW AWAY, because the draw-back proof
 * below CANNOT see a small loop go. That test is a share of the WHOLE ink,
 * and this drawing's four smallest loops — the finial's white centre and the
 * three tier diamonds — are 0.2% to 0.8% each against a 6% tolerance: drop
 * every one of them and it still reads 96.7% painted and exits 0. (CLAUDE.md
 * says exactly this of coverage tests in the corner seal's note: "A whole
 * stroke inside a big loop is a per cent or two of that loop's pixels, so
 * COVERAGE barely moves".) So the threshold is compared against what it KEPT:
 * anything cut that is within a third of the smallest survivor is the
 * drawing, not speckle. Made to fail on purpose before it was trusted —
 * GLYPH_MIN_AREA=600 stops with the four diamonds named.
 */
const raw = contours({ ink: m, W, H });
const areaOf = (p) => Math.abs(loopArea(p));
const kept = raw.filter((p) => areaOf(p) >= MIN_AREA);
const cut = raw.filter((p) => areaOf(p) < MIN_AREA);
if (!kept.length) fail('no loops came out of the drawing');
const smallestKept = Math.min(...kept.map(areaOf));
const biggestCut = cut.length ? Math.max(...cut.map(areaOf)) : 0;
console.log(
  `  MIN_AREA ${MIN_AREA} threw away ${cut.length} loops, the biggest`
  + ` ${biggestCut.toFixed(1)}px; the smallest kept is ${smallestKept.toFixed(1)}px`,
);
if (biggestCut > smallestKept / 3) {
  fail(
    `MIN_AREA is eating the drawing: it dropped a ${biggestCut.toFixed(1)}px loop`
    + ` where the smallest kept is ${smallestKept.toFixed(1)}px`,
  );
}
const loops = kept.map((p) => simplify(p, EPS));
/** `toPath` puts them in a box 100 units across the long side, as it does for
 *  the glass and the dots; the component sizes it from there. */
const { d, vw: VW, vh: VH, points } = toPath(loops);
console.log(`  ${loops.length} loops, ${points} points, ${d.length} bytes, ${VW} x ${VH} units (${(VW / VH).toFixed(3)} wide for its height)`);

// ---- and it must draw back as what was traced ------------------------------
/*
 * The same proof the corner seal's build carries, for the same reason: three
 * things between the mask and the path can quietly drop a piece of the
 * drawing — MIN_AREA throwing a small loop away, `simplify` collapsing a thin
 * one, and the even-odd fill turning a loop inside out. None of them says so;
 * the mark simply loses a stroke. So the path is drawn back at the size it was
 * traced and compared with the mask it came from.
 */
{
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${iw}" height="${ih}" viewBox="0 0 ${VW} ${VH}">`
    + `<path d="${d}" fill="#000" fill-rule="evenodd"/></svg>`;
  const { data: back } = await sharp(Buffer.from(svg)).flatten({ background: '#ffffff' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true });
  let want = 0; let got = 0; let missing = 0; let extra = 0;
  for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
    const a = ink[(y0 + y) * W0 + x0 + x];
    const b = back[y * iw + x] < 128 ? 1 : 0;
    if (a) want++; if (b) got++;
    if (a && !b) missing++; if (!a && b) extra++;
  }
  const pct = (v) => ((100 * v) / want).toFixed(2);
  console.log(`  drawn back: ${pct(want - missing)}% of the drawing painted, ${pct(extra)}% painted that was not there`);
  if (missing > 0.06 * want) fail(`${pct(missing)}% of the drawing is missing from the path — a stroke is being lost`);
  if (extra > 0.06 * want) fail(`${pct(extra)}% of the path is not in the drawing — a loop is inside out`);
}

if (process.env.GLYPH_PREVIEW) {
  mkdirSync('.tmp', { recursive: true });
  /* The button as the page draws it, both ways round — at rest, and filled
     black with its lines red under the pointer — at the sizes the row's zoom
     actually produces. */
  const B = 33; const RULE = 2; const k = MARK / Math.max(VW, VH);
  const svg = (px, fg, bg) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px * 8}" height="${px * 8}" viewBox="0 0 ${B} ${B}">`
    + `<rect width="${B}" height="${B}" fill="#010101"/>`
    + `<rect x="${RULE}" y="${RULE}" width="${B - 2 * RULE}" height="${B - 2 * RULE}" fill="${bg}"/>`
    + `<g transform="translate(${(B - VW * k) / 2} ${(B - VH * k) / 2}) scale(${k})">`
    + `<path d="${d}" fill="${fg}" fill-rule="evenodd"/></g></svg>`;
  const tiles = [];
  for (const px of [22, 25, 33, 60]) for (const [fg, bg] of [['#010101', '#ffffff'], ['#ff0000', '#010101']]) {
    const small = await sharp(Buffer.from(svg(px, fg, bg))).resize({ width: px, kernel: 'lanczos3' }).png().toBuffer();
    tiles.push(await sharp(small).resize({ width: 240, kernel: 'nearest' }).png().toBuffer());
  }
  await sharp({ create: { width: 250 * tiles.length, height: 240, channels: 3, background: '#cccccc' } })
    .composite(tiles.map((t, i) => ({ input: t, left: i * 250 + 5, top: 0 })))
    .png()
    .toFile('.tmp/pagoda-glyph.png');
  console.log('  GLYPH_PREVIEW: wrote .tmp/pagoda-glyph.png (22 / 25 / 33 / 60px, each at rest and lit)');
}

writeFileSync(
  OUT,
  `/**
 * THE CORNER BUTTON'S MARK — the owner's pagoda, cut out of the disc it was
 * drawn inside. Generated by \`npm run build:pagodaglyph\` from
 * ${SRC}; do not edit by hand.
 *
 * Drawn INLINE and filled with \`currentColor\`, EVEN-ODD, because the button
 * fills black under the pointer and its lines go red — a colour an <img>
 * cannot be given.
 *
 * ${loops.length} loops, ${points} points, ${d.length} bytes of path.
 */
import type { CigGlyph } from './cigToggleGlyph';

/**
 * SIZED BY THE CHARACTER CELLS' OWN RULE (the owner's "the same scale as the
 * character buttons"): each of those is a ${MARK + 6}px box whose 2px rule leaves
 * ${MARK + 2}, with a ${MARK}px mark and a pixel of air all round. This mark's LONG side
 * is that ${MARK} and the other follows, so it is never stretched.
 */
export const PAGODA_GLYPH: CigGlyph = {
  viewBox: '0 0 ${VW} ${VH}',
  transform: '',
  d: '${d}',
  fillRule: 'evenodd',
  width: ${+((MARK * VW) / Math.max(VW, VH)).toFixed(2)},
  height: ${+((MARK * VH) / Math.max(VW, VH)).toFixed(2)},
};
`,
);
console.log(`wrote ${OUT}: ${VW} x ${VH} units, ${d.length} bytes of path`);
