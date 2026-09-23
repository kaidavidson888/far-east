/**
 * THE OWNER'S 遠東, CUT OUT OF THEIR OWN VECTOR — shared by the two things
 * that need it.
 *
 *   `sealChars()`     the split: where each character is in the drawing.
 *   `sealCoverage()`  each one stretched into its own square, as coverage.
 *
 * TWO BUILDS READ THIS AND THEY MUST NOT DRIFT ON WHERE THE SPLIT IS.
 *   - `npm run build:sealglyph` hollows each character into a ring
 *     (lib/sealGlyph.ts). Orphaned since the seal became the landing page's
 *     menu button, and kept because it is the owner's tooling.
 *   - `npm run build:growmenu` draws them FILLED, as the mark that drains
 *     (the owner's 2026-09-23 ask). It needs coverage, not a path: the mark
 *     is rasterised into the animation's frames.
 * The split rule below is subtle enough to be worth exactly one copy — see
 * what copying cost the dots menu (scripts/lib/menu-gif.mjs).
 */
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/logo-characters.svg';
/** The width the vector is rasterised at before anything is measured. */
const R = 2048;

/**
 * The drawing, and where the two characters are in it.
 *
 * Returns the raster (`ink(x, y)`), the two characters' ink boxes in its
 * coordinates, and the gap the owner drew them with as a fraction of a
 * character's width.
 */
export async function sealChars({ log = () => {} } = {}) {
  const { data, info } = await sharp(readFileSync(SRC))
    .resize({ width: R })
    .flatten({ background: '#ffffff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const ink = (x, y) => data[y * W + x] < 128;
  const fail = (m) => {
    throw new Error(`seal-mark: ${m}`);
  };

  /** The rows that carry ink, grouped into characters. */
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
  let split = 1;
  let widest = -1;
  for (let i = 1; i < bands.length; i++) {
    const g = bands[i].y0 - bands[i - 1].y1;
    if (g > widest) { widest = g; split = i; }
  }
  log(`  ${bands.length} bands of ink; the widest gap is ${widest}px, before band ${split + 1}`);
  const chars = [
    { y0: bands[0].y0, y1: bands[split - 1].y1 },
    { y0: bands[split].y0, y1: bands[bands.length - 1].y1 },
  ].map((b) => {
    let x0 = W;
    let x1 = -1;
    for (let y = b.y0; y < b.y1; y++) for (let x = 0; x < W; x++) if (ink(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    return { x0, x1: x1 + 1, y0: b.y0, y1: b.y1, w: x1 + 1 - x0, h: b.y1 - b.y0 };
  });

  /** The owner's own gap between them, as a fraction of a character's width. */
  const g = chars[1].y0 - chars[0].y1;
  const mean = (chars[0].w + chars[1].w) / 2;
  const gap = g / mean;

  return { W, H, ink, chars, gap, gapPx: g, meanW: mean, src: SRC };
}

/**
 * EACH CHARACTER STRETCHED INTO ITS OWN SQUARE, as coverage in [0,1].
 *
 * `side` is in device px. The square is supersampled by `OVER` and box-
 * filtered down, which is what gives a mark this small a clean edge — the
 * same treatment the mountain's gets.
 *
 * THE STRETCH IS THE OWNER'S ASK ("scale them to be individually square"),
 * and it costs about a part in five hundred: the two are drawn 639x637 and
 * 675x675. It is done HERE, on the way into the square, so nothing
 * downstream has to know the characters were not square to begin with.
 *
 * With `line` — a fraction of the square's own side — what comes back is the
 * RING instead of the silhouette: see `sealRing`.
 */
const OVER = 8;

/**
 * The character as a binary square at `OVER` times the asked-for size, with
 * `pad` supersampled px of PAPER round it.
 *
 * THE PAD IS NOT OPTIONAL WHEREVER A DISTANCE IS TAKEN. A character is
 * cropped to its own ink, so its outermost strokes LIE ON the square's edges,
 * and a distance transform only sees the buffer it is given: with no pad it
 * reads "off the top" as more ink rather than as paper, the top stroke is
 * nowhere near any paper, and it comes out with no line along it. The owner
 * saw exactly that on the corner seal — "at the top of both characters and at
 * the very bottom there seems to be some sort of clipping" — and it is the
 * same trap the mountain's `keep` field fell into. Three scripts now.
 */
function square(ink, c, side, pad) {
  const S = side * OVER;
  const B = S + pad * 2;
  const big = new Uint8Array(B * B);
  for (let y = 0; y < S; y++) {
    const sy = c.y0 + Math.min(c.h - 1, Math.floor((y / S) * c.h));
    for (let x = 0; x < S; x++) {
      const sx = c.x0 + Math.min(c.w - 1, Math.floor((x / S) * c.w));
      if (ink(sx, sy)) big[(y + pad) * B + x + pad] = 1;
    }
  }
  return { big, S, B, pad };
}

/** Box-filter a padded supersampled square down to coverage at `side`. */
function down({ big, B, pad }, side) {
  const cov = new Float32Array(side * side);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    let n = 0;
    for (let sy = 0; sy < OVER; sy++) for (let sx = 0; sx < OVER; sx++) {
      n += big[(y * OVER + sy + pad) * B + x * OVER + sx + pad];
    }
    cov[y * side + x] = n / (OVER * OVER);
  }
  return cov;
}

export function sealCoverage({ ink, chars }, side) {
  return chars.map((c) => down(square(ink, c, side, 0), side));
}

/**
 * THE SAME CHARACTERS AS AN OUTLINE — the silhouette less the silhouette
 * eroded by the line's width, which is what "an outline of the characters"
 * is (the owner's 2026-09-23 "when the black drains from the characters it
 * leave behind an outline of the characters"). One even-odd band following
 * every edge, outside and in.
 *
 * `line` is a fraction of the square's own side, so the outline is the same
 * weight relative to the character at any size it is asked for. The corner
 * seal's proven value is 1.2 of a 58px mark; `SEAL_RING` overrides it.
 *
 * IT IS TAKEN AT `OVER` TIMES THE FINAL SIZE AND FILTERED DOWN, and that is
 * the whole reason this is not done on the small raster. At the size the menu
 * draws these, the line is about one device pixel: eroded on the finished
 * 54px square there is nothing for a distance transform to be accurate about
 * and the "outline" comes out as the character again, half-strength. Eroded
 * at 432px and filtered down, it is a real line with real antialiasing.
 */
export function sealRing({ ink, chars }, side, line) {
  const lineSS = line * side * OVER;
  const pad = Math.ceil(lineSS) + 2;
  return chars.map((c) => {
    const sq = square(ink, c, side, pad);
    const { big, B } = sq;
    // distance from every cell to the nearest PAPER: ink deeper than the
    // line survives the erosion, and what the erosion drops is the ring
    const paper = new Uint8Array(B * B);
    for (let i = 0; i < B * B; i++) paper[i] = big[i] ? 0 : 1;
    const d = distanceTo(paper, B, B);
    const ring = new Uint8Array(B * B);
    for (let i = 0; i < B * B; i++) ring[i] = big[i] && d[i] <= lineSS ? 1 : 0;
    return down({ big: ring, B, pad }, side);
  });
}

/**
 * Euclidean distance to the nearest set cell — the two-pass chamfer the rest
 * of this project uses (`scripts/lib/badge-mark.mjs`, `trace-mark.mjs`),
 * written here so this module stays free of either.
 */
function distanceTo(m, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? 0 : INF;
  const D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i];
    if (y > 0) {
      if (x > 0) v = Math.min(v, d[i - w - 1] + D2);
      v = Math.min(v, d[i - w] + 1);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2);
    }
    if (x > 0) v = Math.min(v, d[i - 1] + 1);
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i];
    if (y < h - 1) {
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2);
      v = Math.min(v, d[i + w] + 1);
      if (x > 0) v = Math.min(v, d[i + w - 1] + D2);
    }
    if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
    d[i] = v;
  }
  return d;
}
