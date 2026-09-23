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
 */
const OVER = 8;
export function sealCoverage({ ink, chars }, side) {
  const S = side * OVER;
  return chars.map((c) => {
    const big = new Uint8Array(S * S);
    for (let y = 0; y < S; y++) {
      const sy = c.y0 + Math.min(c.h - 1, Math.floor((y / S) * c.h));
      for (let x = 0; x < S; x++) {
        const sx = c.x0 + Math.min(c.w - 1, Math.floor((x / S) * c.w));
        if (ink(sx, sy)) big[y * S + x] = 1;
      }
    }
    const cov = new Float32Array(side * side);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      let n = 0;
      for (let sy = 0; sy < OVER; sy++) for (let sx = 0; sx < OVER; sx++) {
        n += big[(y * OVER + sy) * S + x * OVER + sx];
      }
      cov[y * side + x] = n / (OVER * OVER);
    }
    return cov;
  });
}
