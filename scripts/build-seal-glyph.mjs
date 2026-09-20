/**
 * Cuts the owner's 遠東 into the corner seal's mark.
 *
 *   npm run build:sealglyph
 *
 * The owner's 2026-09-20 ask, with their seal attached: "turn just the chinese
 * characters in this image into a square seal button 2x as big as the mountain
 * button in the right corner of the screen with 10px margins on its top and
 * right edges. Make the characters just a black outline".
 *
 * WHERE THE CHARACTERS COME FROM. Not the attached picture: the same two
 * characters are already in the repo as the owner's own vector,
 * `scripts/assets/logo-characters.svg` (the landing page's 遠東, which the
 * seal in that picture is set from). Tracing a screenshot of them when the
 * drawing itself is on disk would cost fidelity for nothing. They are STACKED
 * there and SIDE BY SIDE in the seal, so the build cuts each one out and lays
 * the pair out again the way the seal does.
 *
 * "JUST A BLACK OUTLINE" is a ring: the character's silhouette less the
 * silhouette eroded by the line's width, traced as one even-odd path so that
 * it fills with `currentColor` and inverts with its button, exactly as the
 * plus, the minus, the glass and the dots do. The line is stated in the px
 * the mark is DRAWN at and converted into the trace's own scale, because it
 * is a line on the page rather than a fraction of a character.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { contours, loopArea, simplify, toPath, distanceTo } from './lib/trace-mark.mjs';

const SRC = 'scripts/assets/logo-characters.svg';
const OUT = 'lib/sealGlyph.ts';

/** How big the pair is traced, in px across both characters. */
const TRACE = 1600;
/** The mark's drawn width, in the button's own px — see SEAL_BOX. */
const MARK = Number(process.env.SEAL_MARK ?? 54);
/** The black line's width, in drawn px. */
const LINE = Number(process.env.SEAL_LINE ?? 1.1);
/**
 * The space between the two characters, as a fraction of a character's width.
 * The owner's own spacing, measured: they are stacked in the vector with a
 * gap of their own, and that gap — read off the render, not chosen — is what
 * the pair is set with when it is turned on its side.
 */
const EPS = 1.2;
const MIN_AREA = 40;

const fail = (m) => {
  throw new Error(`build-seal-glyph: ${m}`);
};

// ---- the two characters ------------------------------------------------------
const R = 2048;
const { data, info } = await sharp(readFileSync(SRC))
  .resize({ width: R })
  .flatten({ background: '#ffffff' })
  .greyscale()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const ink = (x, y) => data[y * W + x] < 128;

/** The rows that carry ink, grouped into characters. */
const chars = (() => {
  const bands = [];
  let run = null;
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x++) if (ink(x, y)) n++;
    if (n && !run) run = { y0: y };
    if (!n && run) { run.y1 = y; bands.push(run); run = null; }
  }
  if (run) { run.y1 = H; bands.push(run); }
  if (!bands.length) fail('no ink in the vector');
  /*
   * A CHARACTER'S OWN STROKES LEAVE GAPS TOO, so the split is the LARGEST gap
   * rather than a threshold: there are two characters, so there is exactly
   * one gap between them and it is the biggest. Measured here it is 192px
   * against the 26px inside 遠 — a threshold set between those two would work
   * today and break on the next drawing.
   */
  if (bands.length < 2) fail(`the vector has ${bands.length} band of ink; it should have several`);
  let cut = 1, widest = -1;
  for (let i = 1; i < bands.length; i++) {
    const g = bands[i].y0 - bands[i - 1].y1;
    if (g > widest) { widest = g; cut = i; }
  }
  console.log(`  ${bands.length} bands of ink; the widest gap is ${widest}px, before band ${cut + 1}`);
  const out = [
    { y0: bands[0].y0, y1: bands[cut - 1].y1 },
    { y0: bands[cut].y0, y1: bands[bands.length - 1].y1 },
  ];
  if (out.length !== 2) fail(`expected two characters, found ${out.length}`);
  return out.map((b) => {
    let x0 = W, x1 = -1;
    for (let y = b.y0; y < b.y1; y++) for (let x = 0; x < W; x++) if (ink(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    return { x0, x1: x1 + 1, y0: b.y0, y1: b.y1, w: x1 + 1 - x0, h: b.y1 - b.y0 };
  });
})();
console.log(`${SRC}: ${W}x${H}`);
chars.forEach((c, i) => console.log(`  character ${i + 1}: ${c.w}x${c.h} at ${c.x0},${c.y0}`));

/** The owner's own gap between them, as a fraction of a character's width. */
const GAP = (() => {
  const g = chars[1].y0 - chars[0].y1;
  const mean = (chars[0].w + chars[1].w) / 2;
  console.log(`  the gap they are drawn with: ${g}px against a ${Math.round(mean)}px character (${((100 * g) / mean).toFixed(1)}%)`);
  return g / mean;
})();

// ---- side by side, at the trace's own scale ---------------------------------
/**
 * THE PAIR IS STRETCHED INTO A SQUARE — the owner's "stretch the characters so
 * they are a square together". Two square characters side by side make a box
 * twice as wide as it is tall, which left the seal's own square mostly air;
 * a two-character seal is cut the other way round, each character taking half
 * the field and the full height of it. So the strip is square and each
 * character is drawn to its FULL height, which is a vertical stretch of about
 * 2.2 — and both to the SAME height rather than each keeping its own, because
 * they share one field.
 *
 * IT IS STRETCHED BEFORE THE RING IS TAKEN, not after. Scaling the finished
 * outline would scale its line with it and the mark would carry a 2.2x
 * heavier line across the top of every stroke than down its side; stretching
 * the silhouette first and eroding it after gives one line all the way round.
 * What the stretch does show is the STROKES: a horizontal one is 2.2x deeper
 * than it was drawn and a vertical one is untouched, so the hollows are
 * generous one way and tight the other. That is what stretching type does,
 * and it is what a cut seal does on purpose.
 */
const wide = chars[0].w + chars[1].w + GAP * ((chars[0].w + chars[1].w) / 2);
const K = TRACE / wide;
const SW = Math.round(wide * K), SH = SW;
const strip = new Uint8Array(SW * SH);
{
  let at = 0;
  for (const c of chars) {
    const dx = Math.round(at * K);
    const cw = Math.round(c.w * K), ch = SH;
    for (let y = 0; y < ch; y++) {
      const sy = c.y0 + Math.min(c.h - 1, Math.floor((y / ch) * c.h));
      for (let x = 0; x < cw; x++) {
        const sx = c.x0 + Math.min(c.w - 1, Math.floor((x / cw) * c.w));
        if (!ink(sx, sy)) continue;
        const X = dx + x, Y = y;
        if (X >= 0 && Y >= 0 && X < SW && Y < SH) strip[Y * SW + X] = 1;
      }
    }
    at += c.w + GAP * ((chars[0].w + chars[1].w) / 2);
  }
  console.log(`  stretched into a square: ${SW}x${SH}, each character x${(SH / ((chars[0].h + chars[1].h) / 2) / K).toFixed(2)} taller than it was drawn`);
}

// ---- the ring ----------------------------------------------------------------
/**
 * The silhouette less itself eroded by the line's width: what is left is a
 * band that follows every edge, outside and in, which is what "just a black
 * outline" means. The erosion is a distance transform against the COMPLEMENT
 * — the distance to the nearest paper — the way trace-mark's own `erode`
 * learned to do it.
 */
const lineTrace = (LINE * TRACE) / MARK;
const ring = (() => {
  const paper = new Uint8Array(SW * SH);
  for (let i = 0; i < SW * SH; i++) paper[i] = strip[i] ? 0 : 1;
  const d = distanceTo(paper, SW, SH); // 0 on paper, growing into the ink
  const m = { ink: new Uint8Array(SW * SH), W: SW, H: SH };
  let kept = 0;
  for (let i = 0; i < SW * SH; i++) {
    m.ink[i] = strip[i] && d[i] <= lineTrace ? 1 : 0;
    kept += m.ink[i];
  }
  const all = strip.reduce((n, v) => n + v, 0);
  console.log(`  the line is ${LINE}px drawn (${lineTrace.toFixed(1)} traced): ${((100 * kept) / all).toFixed(1)}% of the ink is kept`);
  if (kept / all > 0.9) fail('the outline keeps almost all of the ink: the line is too thick for these strokes');
  return m;
})();

const loops = contours(ring).filter((p) => Math.abs(loopArea(p)) >= MIN_AREA).map((p) => simplify(p, EPS));
if (!loops.length) fail('nothing was traced');
const { d, vw: VW, vh: VH, points } = toPath(loops);

writeFileSync(
  OUT,
  `/**
 * THE CORNER SEAL'S MARK — the owner's 遠東, side by side and hollowed out.
 * Generated by \`npm run build:sealglyph\` from scripts/assets/logo-characters.svg;
 * do not edit by hand. Drawn inline and filled with \`currentColor\`, EVEN-ODD,
 * so that it inverts with its button as every other mark on this row does.
 *
 * ${loops.length} loops, ${points} points, ${d.length} bytes of path. The line
 * is ${LINE}px at a drawn width of ${MARK}.
 */
import type { CigGlyph } from './cigToggleGlyph';

export const SEAL_GLYPH: CigGlyph = {
  viewBox: '0 0 ${VW} ${VH}',
  transform: '',
  d: '${d}',
  fillRule: 'evenodd',
  width: ${MARK},
  height: ${+((MARK * VH) / VW).toFixed(2)},
};
`,
);
console.log(`  ${loops.length} loops, ${points} points, ${d.length} bytes`);
console.log(`  the mark is ${VW} x ${VH} units, drawn ${MARK} x ${+((MARK * VH) / VW).toFixed(2)}`);
console.log(`wrote ${OUT}`);

if (process.env.SEAL_PREVIEW) {
  mkdirSync('.tmp', { recursive: true });
  const B = 66, RULE = 2, k = MARK / VW;
  const svg = (px, fg, bg) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px * 8}" height="${px * 8}" viewBox="0 0 ${B} ${B}">` +
    `<rect width="${B}" height="${B}" fill="#010101"/><rect x="${RULE}" y="${RULE}" width="${B - 2 * RULE}" height="${B - 2 * RULE}" fill="${bg}"/>` +
    `<g transform="translate(${(B - VW * k) / 2} ${(B - VH * k) / 2}) scale(${k})">` +
    `<path d="${d}" fill="${fg}" fill-rule="evenodd"/></g></svg>`;
  const tiles = [];
  for (const px of [48, 66, 132]) {
    for (const [fg, bg] of [['#010101', '#ffffff'], ['#ffffff', '#010101']]) {
      const small = await sharp(Buffer.from(svg(px, fg, bg))).resize({ width: px, kernel: 'lanczos3' }).png().toBuffer();
      tiles.push(await sharp(small).resize({ width: 240, kernel: 'nearest' }).png().toBuffer());
    }
  }
  await sharp({ create: { width: 246 * 6, height: 248, channels: 3, background: '#cccccc' } })
    .composite(tiles.map((t, i) => ({ input: t, left: i * 246 + 3, top: 4 })))
    .png()
    .toFile(`.tmp/seal-glyph-${LINE}.png`);
  console.log(`  SEAL_PREVIEW: wrote .tmp/seal-glyph-${LINE}.png (48 / 66 / 132px, each way round)`);
}
