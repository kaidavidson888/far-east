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

// ---- one square each ---------------------------------------------------------
/**
 * EACH CHARACTER IS CUT ON ITS OWN, STRETCHED INTO ITS OWN SQUARE — the
 * owner's "make them two seperate characters in square outlines and scale
 * them to be individually square but make them 1 button with 5px margin
 * between". So there is no strip and no shared field any more: the page draws
 * two boxes with a gap, and each box holds one character filling it.
 *
 * They are very nearly square as drawn (639x637 and 675x675), so this is a
 * stretch of about a part in five hundred — the shape is the owner's, and
 * saying "scale them to be individually square" costs it nothing.
 *
 * THE STRETCH COMES BEFORE THE RING, as it did when the pair shared a field:
 * scaling a finished outline scales its line with it, and the mark would
 * carry a heavier line one way than the other. Here the stretch is tiny, but
 * the order is the same so the reason does not have to be rediscovered.
 */
const lineTrace = (LINE * TRACE) / MARK;
/**
 * THE SQUARE IS PADDED WITH PAPER BEFORE THE RING IS TAKEN, and it has to be.
 *
 * A character is cropped to its own ink, so its outermost strokes LIE ON the
 * square's edges — and a distance transform only sees the buffer it is given,
 * so with no pad it reads "off the top" as more ink rather than as paper. The
 * top of the top stroke was then nowhere near any paper, fell outside the
 * ring, and was drawn with no line along it: the owner saw exactly that, "at
 * the top of both characters and at the very bottom there seems to be some
 * sort of clipping". Measured before the pad: 119 and 329 px of 遠's edges
 * and 138 and 138 of 東's carried silhouette but no outline.
 *
 * The shared tracer pads for this reason (`inkMask(src, { pad })`); this
 * build makes its own raster and so has to do it itself. It is the same trap
 * the mountain's `keep` field fell into — "THE FRAME'S OWN EDGE COUNTS AS THE
 * OUTSIDE" in scripts/build-grow-menu.mjs.
 */
const PAD = Math.ceil(lineTrace) + 2;
const cut = (c, i) => {
  const S = TRACE, B = S + 2 * PAD;
  const box = new Uint8Array(B * B);
  for (let y = 0; y < S; y++) {
    const sy = c.y0 + Math.min(c.h - 1, Math.floor((y / S) * c.h));
    for (let x = 0; x < S; x++) {
      const sx = c.x0 + Math.min(c.w - 1, Math.floor((x / S) * c.w));
      if (ink(sx, sy)) box[(y + PAD) * B + x + PAD] = 1;
    }
  }
  /*
   * The silhouette less itself eroded by the line's width: what is left is a
   * band following every edge, outside and in, which is what "just a black
   * outline" means. The erosion is a distance transform against the
   * COMPLEMENT — the distance to the nearest paper — the way trace-mark's own
   * `erode` learned to do it.
   */
  const paper = new Uint8Array(B * B);
  for (let j = 0; j < B * B; j++) paper[j] = box[j] ? 0 : 1;
  const dist = distanceTo(paper, B, B);
  const m = { ink: new Uint8Array(B * B), W: B, H: B };
  let kept = 0, all = 0;
  for (let j = 0; j < B * B; j++) {
    all += box[j];
    m.ink[j] = box[j] && dist[j] <= lineTrace ? 1 : 0;
    kept += m.ink[j];
  }
  /*
   * AND THE EDGES ARE ASKED DIRECTLY, because this is the failure that got
   * through a check of the path against the ring: it proved the drawing
   * faithful to a ring that was itself short. Every pixel of the silhouette
   * lying on the square's own border must carry outline — it is the outermost
   * ink there is, so it is boundary by definition.
   */
  {
    let onEdge = 0, lit = 0;
    for (let k = 0; k < S; k++) {
      for (const j of [
        (PAD + 0) * B + PAD + k,
        (PAD + S - 1) * B + PAD + k,
        (PAD + k) * B + PAD,
        (PAD + k) * B + PAD + S - 1,
      ]) {
        if (!box[j]) continue;
        onEdge++;
        if (m.ink[j]) lit++;
      }
    }
    if (lit < onEdge) fail(`character ${i + 1}: ${onEdge - lit} of the ${onEdge} px on the square's own edges carry no outline — the ring is short there`);
    console.log(`    ${onEdge} px of it lie on the square's edges, all of them outlined`);
  }
  console.log(`  character ${i + 1}: stretched x${(c.w / c.h).toFixed(3)} into its square; the ${LINE}px line keeps ${((100 * kept) / all).toFixed(1)}% of its ink`);
  if (kept / all > 0.9) fail(`character ${i + 1}'s outline keeps almost all of its ink: the line is too thick for these strokes`);
  const loops = contours(m).filter((p) => Math.abs(loopArea(p)) >= MIN_AREA).map((p) => simplify(p, EPS));
  if (!loops.length) fail(`character ${i + 1} traced to nothing`);
  const out = toPath(loops);
  console.log(`    ${loops.length} loops, ${out.points} points, ${out.d.length} bytes, ${out.vw} x ${out.vh} units`);
  return { ...out, loops: loops.length, ring: m.ink, S: B };
};
const marks = [];
for (let i = 0; i < chars.length; i++) marks.push(cut(chars[i], i));

// ---- and NOT ONE LINE MISSING ------------------------------------------------
/**
 * NO STROKE MAY BE LOST BETWEEN THE RING AND THE PATH (the owner's "make sure
 * there is no missing lines in the characters"). Three things could drop one:
 * `MIN_AREA` throwing away a small loop, `simplify` collapsing a thin one, and
 * the even-odd fill turning a loop inside out. None of them announces itself —
 * the mark just quietly loses a stroke — so the build draws its own path back
 * at the size it traced and asks the pixels.
 *
 * TWO MEASURES, because either alone can be fooled. A whole stroke inside a
 * big loop is a per cent or two of that loop's pixels, so COVERAGE would
 * barely move; and a ring that is complete but shifted would pass a local
 * test. So: every connected piece of the ring must be at least 90% painted,
 * AND no pixel of the ring may sit further from painted ink than the line's
 * own width. A missing stroke fails the second by hundreds of px.
 */
for (let i = 0; i < marks.length; i++) {
  const m = marks[i], S = m.S;
  /*
   * DRAWN BACK INTO THE PADDED FRAME. The path's own box is the ring's, which
   * sits PAD inside this buffer, so the viewBox is widened by that much in
   * the path's own units — render it at 0,0 and the whole mark is stretched
   * over the pad and every comparison below is nonsense (it read 41% painted
   * the first time, which is what the pad had shifted, not what was lost).
   */
  const px = PAD * (m.vw / (S - 2 * PAD)), py = PAD * (m.vh / (S - 2 * PAD));
  const shot = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" ` +
        `viewBox="${-px} ${-py} ${m.vw + 2 * px} ${m.vh + 2 * py}">` +
        `<path d="${m.d}" fill="#000000" fill-rule="evenodd"/></svg>`,
    ),
  )
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer();
  const unpainted = new Uint8Array(S * S);
  for (let j = 0; j < S * S; j++) unpainted[j] = shot[j] < 128 ? 0 : 1;
  const toInk = distanceTo(unpainted, S, S);
  let far = 0, farAt = null;
  for (let j = 0; j < S * S; j++) {
    if (m.ring[j] && toInk[j] > far) { far = toInk[j]; farAt = [j % S, (j / S) | 0]; }
  }
  // the pieces of the ring, 8-connected, and how much of each was painted
  const seen = new Uint8Array(S * S);
  let pieces = 0, worst = 1;
  const stack = [];
  for (let start = 0; start < S * S; start++) {
    if (!m.ring[start] || seen[start]) continue;
    pieces++;
    let all = 0, hit = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const j = stack.pop();
      all++;
      if (!unpainted[j]) hit++;
      const x = j % S, y = (j / S) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
          const k = ny * S + nx;
          if (m.ring[k] && !seen[k]) { seen[k] = 1; stack.push(k); }
        }
      }
    }
    if (hit / all < worst) worst = hit / all;
  }
  console.log(
    `  character ${i + 1} drawn back: ${pieces} pieces, the poorest ${(100 * worst).toFixed(1)}% painted,` +
      ` the furthest any of it sits from ink ${far.toFixed(1)}px of the line's ${lineTrace.toFixed(1)}`,
  );
  if (worst < 0.9) fail(`character ${i + 1} has a piece of outline only ${(100 * worst).toFixed(1)}% painted: a stroke is being lost`);
  if (far > lineTrace) {
    fail(`character ${i + 1} has ring ${far.toFixed(1)}px from the nearest painted ink at ${JSON.stringify(farAt)}, past the line's own ${lineTrace.toFixed(1)}: a stroke is missing`);
  }
}

writeFileSync(
  OUT,
  `/**
 * THE CORNER SEAL'S MARKS — the owner's 遠 and 東, each hollowed out and each
 * squared into its own box. Generated by \`npm run build:sealglyph\` from
 * scripts/assets/logo-characters.svg; do not edit by hand. Drawn inline and
 * filled with \`currentColor\`, EVEN-ODD, so they invert with their button as
 * every other mark on this page does.
 *
 * TWO GLYPHS, ONE BUTTON: the page draws a square round each and 5px between
 * them, and the whole thing is one control (the owner's ask). The line is
 * ${LINE}px at a drawn width of ${MARK}.
 */
import type { CigGlyph } from './cigToggleGlyph';

export const SEAL_GLYPHS: CigGlyph[] = [
${marks
  .map(
    (m) => `  {
    viewBox: '0 0 ${m.vw} ${m.vh}',
    transform: '',
    d: '${m.d}',
    fillRule: 'evenodd',
    width: ${MARK},
    height: ${+((MARK * m.vh) / m.vw).toFixed(2)},
  },`,
  )
  .join('\n')}
];
`,
);
console.log(`wrote ${OUT}: ${marks.length} marks, ${marks.reduce((n, m) => n + m.d.length, 0)} bytes of path`);

if (process.env.SEAL_PREVIEW) {
  mkdirSync('.tmp', { recursive: true });
  /** The button as the page draws it: two boxes, a gap, one control. */
  const B = 66, RULE = 2, SPACE = 5;
  const svg = (px, fg, bg) => {
    const k = px / B;
    const W = B * 2 + SPACE;
    const boxes = marks
      .map((m, i) => {
        const ox = i * (B + SPACE), s = MARK / m.vw;
        return (
          `<rect x="${ox}" y="0" width="${B}" height="${B}" fill="${fg}"/>` +
          `<rect x="${ox + RULE}" y="${RULE}" width="${B - 2 * RULE}" height="${B - 2 * RULE}" fill="${bg}"/>` +
          `<g transform="translate(${ox + (B - MARK) / 2} ${(B - m.vh * s) / 2}) scale(${s})">` +
          `<path d="${m.d}" fill="${fg}" fill-rule="evenodd"/></g>`
        );
      })
      .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * k * 8}" height="${B * k * 8}" viewBox="0 0 ${W} ${B}">${boxes}</svg>`;
  };
  const tiles = [];
  for (const px of [48, 66, 120]) {
    for (const [fg, bg] of [['#010101', '#ffffff'], ['#ffffff', '#010101']]) {
      const w = Math.round((px * (B * 2 + SPACE)) / B);
      const small = await sharp(Buffer.from(svg(px, fg, bg))).resize({ width: w, kernel: 'lanczos3' }).png().toBuffer();
      tiles.push(await sharp(small).resize({ width: 460, kernel: 'nearest' }).png().toBuffer());
    }
  }
  const meta = await sharp(tiles[0]).metadata();
  await sharp({ create: { width: 466 * 3, height: 2 * (meta.height + 6) + 2, channels: 3, background: '#cccccc' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i >> 1) * 466 + 3, top: (i & 1) * (meta.height + 6) + 3 })))
    .png()
    .toFile(`.tmp/seal-glyph-${LINE}.png`);
  console.log(`  SEAL_PREVIEW: wrote .tmp/seal-glyph-${LINE}.png (48 / 66 / 120px, each way round)`);
}
