/**
 * Turns the supplied pack photographs into page-ready marks.
 *
 *   npm run build:cigs
 *
 * The owner supplied 282 pack images of wildly mixed provenance: 1024 square
 * renders with alpha, phone-sized JPEGs on white, a handful of 300px
 * thumbnails. Many carry things that are not the pack — a catalogue number
 * printed underneath, a line of health-warning text, loose cigarettes lying
 * beside the box, a stroke clipped in from a neighbouring image. This levels
 * them into one set of just the boxes.
 *
 * HOW THE BOX IS FOUND. The backdrop is flood-filled in from the border —
 * connected, never a global colour key, because a pack's own white panels
 * are enclosed by its own edges and a global key eats them. What is left is
 * split into connected components; the box is far and away the largest, so
 * the crop is its bounding box plus any piece that genuinely overlaps it.
 * That last part cuts both ways, deliberately:
 *
 *   - it keeps a box whole when a pale band splits it in two — Panda's top
 *     edge comes back as its own 8px sliver and has to be welded back on;
 *   - and it refuses to grow for a piece that merely touches. Peel Pink has
 *     a stroke running down the left edge of the box and on into the caption
 *     below it; merging anything that touched pulled the crop down over the
 *     caption and the number came back. Requiring real overlap rather than
 *     contact is what separates the two cases.
 *
 * That alone is not enough. On several packs a soft drop shadow welds the
 * caption to the box, so they arrive as one component and no amount of
 * component logic will part them. A box is a solid object, though: nearly
 * every row through it spans its full width, where a line of text spans a
 * few percent. So each crop is also offered in a trimmed form, cut to the
 * longest run of solidly-filled rows and columns.
 *
 * Nor is that, on its own. Two dozen packs sit above a catalogue number with
 * the drop shadow running down into it, and the shadow is as wide as the
 * pack — so measured by coverage the rows below the box are as full as the
 * box's own, 0.87 to 0.97, and no threshold on width finds the bottom edge.
 * What separates them is opacity, not width: the pack is opaque, its shadow
 * is not. `squareOff` measures against that instead, which is what finally
 * took the numbers off. It is held to the same box-shape test as everything
 * else, because on Fiit Menthol it otherwise cut into the box and left it
 * at a ratio of 1.34.
 *
 * WHICH CROP WINS. A cigarette box is a known shape — this set's own ratios
 * sit between about 0.52 and 0.71, and the design draws them at 0.58 to
 * 0.69. So a crop that comes out box-shaped has almost certainly found the
 * box; one that does not has found the box plus something else, or a piece
 * of it. Of the box-shaped candidates the smallest wins, since that is the
 * one that shed the most that was not the box, with a floor so a bad trim
 * cannot eat a real box. Where nothing comes out box-shaped the plain crop
 * is kept untouched and the file is named in the build output — the
 * instruction was to keep the boxes as intact as possible, so where the two
 * aims pull against each other the box wins and I would rather report a
 * miss than damage one.
 *
 * THE GROUND IS THE PAGE'S WHITE. Not transparency: the backdrop is painted
 * #ffffff, exactly the landing page's own background. Several sources sit on
 * an off-white that reads as a faint panel against the page, and these are
 * only ever drawn on that white page.
 *
 * ONE HEIGHT. Every box is scaled to the same height so it sits in the
 * selection frame the same way; the width follows the box's own proportions,
 * which is what the design does (its packs are 90-94 high, 53-63 wide).
 *
 * WHY SVG. The owner asked for SVGs. These are photographs, so there is no
 * sensible vector to trace to — a trace of a pack render is both enormous
 * and worse-looking than the photograph. What an SVG buys here is the thing
 * the rest of the site's marks have: one self-contained file per pack, named
 * for its source, that scales and can be dropped anywhere.
 *
 * NAMES. The file keeps its source basename exactly — `101_Changbaishan-
 * Soft_Red` stays `101_Changbaishan-Soft_Red.svg` — because that is what the
 * buttons will be wired up by later. The display name comes from the
 * supplied menu list, matched on the leading number.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'C:/Users/Kai Davidson/Downloads/Far East/Cigs Images';
const MENU = 'scripts/assets/cigs/menu-list.txt';
const OUT_DIR = 'public/cigs';
const MANIFEST = 'lib/cigs.json';

/** Drawn height in design px, and the backing density. */
// the design's packs are 90, 92, 92, 92 and 94 high; 92 is the middle of that
const DRAWN_H = 92;
const SS = 3;
const QUALITY = 82;

/** The landing page's own background, which these are always drawn on. */
const GROUND = { r: 255, g: 255, b: 255 };

/** Specks below this share of the frame are never a box part. */
const SPECK = 1 / 20000;
/** How much of a piece must lie within the box's span to be part of it. */
const OVERLAP = 0.6;
/** Backdrop tolerances tried: plain paper, then a light grey card. */
const TOLERANCES = [232, 244];
/** A row counts as part of the solid box above this share of the width. */
const DENSE = 0.55;
/** ...and is still worth keeping as a soft edge above this. */
const LOOSE = 0.3;
/** What a cigarette box's width/height can plausibly be. */
const AR_MIN = 0.45;
const AR_MAX = 0.8;
/** No crop may keep less of the box than this share of the largest. */
const KEEP = 0.45;
/** At or above this alpha a pixel is the object, not its shadow. */
const SOLID_ALPHA = 200;
/** A row narrower than this share of the crop is not the pack. */
const SQUARE_FLOOR = 0.35;
/** ...and no more than this share may be squared off either end. */
const SQUARE_MAX = 0.18;

/**
 * The two the reasoning above cannot reach, cropped by hand.
 *
 * Both are photographed on a light card with the catalogue number printed on
 * the card below the pack, and on both the number is drawn at partial alpha
 * — so it is neither a separate component (the card joins everything up) nor
 * distinguishable by opacity (the test that saved the other two dozen).
 * Fiit Menthol also has the clipped edge of the next photograph down its
 * left side, at x=190.
 *
 * Rectangles in source pixels, read off a grid render of each. Everything
 * else in this file is derived; these two are measured by eye, and they are
 * the only numbers here a re-export would invalidate. New source images of
 * those two packs on plain ground would make this table unnecessary.
 */
const HAND_CROP = {
  '281_THIS-Plus': { x0: 370, y0: 155, x1: 740, y1: 685 },
  '284_Fiit-Menthol': { x0: 332, y0: 227, x1: 790, y1: 618 },
  // These two for the opposite reason: the crop was cutting into them.
  // Mevius carries its "Smoking kills" panel as line art on transparency —
  // a black rule and black type over nothing — so by every measure here it
  // looks exactly like a caption, and the owner wants it kept. There is no
  // rule that keeps this and still drops Nanjing's number, because in the
  // source the two are drawn the same way. Its left edge is set past a
  // column of grey tabs that are not part of the photograph.
  '91_Mevius-Blue_6': { x0: 290, y0: 100, x1: 770, y1: 921 },
  // A soft pack, pale down its whole upper half, which the trim read as
  // empty and cut the silver top off.
  '128_Septwolves-Blue_Diamond': { x0: 258, y0: 102, x1: 764, y1: 921 },
  // Its last line of warning text was being cut off the bottom.
  '02_Peel-Greek_Yogurt': { x0: 91, y0: 57, x1: 209, y1: 243 },
  // Clipped down the left: the pack's purple edge and half the ESSE mark.
  '05_ESSE-Double_Shot_Red_White_Wine': { x0: 240, y0: 106, x1: 511, y1: 610 },
};

/** Near-white, and flat enough to be a backdrop rather than a pack panel. */
const isPaper = (d, p, tol) =>
  d[p] > tol &&
  d[p + 1] > tol &&
  d[p + 2] > tol &&
  Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]) < 16;

const isClear = (d, p) => d[p + 3] < 24;

/**
 * Mark the backdrop, flooding in from the border.
 *
 * Connectivity is the whole point: a pack's white panel is enclosed by its
 * own edges, so the flood never reaches it. The flood crosses transparent
 * and near-white alike, so it copes with a cut-out and a photograph on paper
 * without being told which it has.
 */
function backdrop(d, w, h, tol) {
  const bg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (bg[i]) return;
    const p = i * 4;
    if (!(isClear(d, p) || isPaper(d, p, tol))) return;
    bg[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return bg;
}

/** Everything that is not backdrop, grouped into connected pieces. */
function components(bg, w, h) {
  const seen = new Int32Array(w * h).fill(-1);
  const out = [];
  const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (bg[s] || seen[s] >= 0) continue;
    const id = out.length;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    let n = 0;
    seen[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (bg[j] || seen[j] >= 0) continue;
          seen[j] = id;
          stack.push(j);
        }
      }
    }
    out.push({ x0, y0, x1, y1, n });
  }
  return out;
}

/** The share of `c` that lies within `box`, per axis. */
function overlaps(c, box) {
  const ox = Math.min(c.x1, box.x1) - Math.max(c.x0, box.x0) + 1;
  const oy = Math.min(c.y1, box.y1) - Math.max(c.y0, box.y0) + 1;
  if (ox <= 0 || oy <= 0) return false;
  return ox / (c.x1 - c.x0 + 1) >= OVERLAP && oy / (c.y1 - c.y0 + 1) >= OVERLAP;
}

/** The longest run of solidly-filled rows (or columns), plus soft edges. */
function solidRun(dens, lo, hi) {
  let bestStart = -1;
  let bestEnd = -2;
  let start = -1;
  for (let i = lo; i <= hi + 1; i++) {
    const on = i <= hi && dens[i] >= DENSE;
    if (on && start < 0) start = i;
    else if (!on && start >= 0) {
      if (i - 1 - start > bestEnd - bestStart) {
        bestStart = start;
        bestEnd = i - 1;
      }
      start = -1;
    }
  }
  if (bestStart < 0) return null;
  // give back the softer edges — a rounded lid, a shadowed foot
  while (bestStart > lo && dens[bestStart - 1] >= LOOSE) bestStart--;
  while (bestEnd < hi && dens[bestEnd + 1] >= LOOSE) bestEnd++;
  return [bestStart, bestEnd];
}

/** The largest piece, welded to whatever genuinely overlaps it. */
function pieceBox(bg, w, h) {
  const comps = components(bg, w, h).filter((c) => c.n > w * h * SPECK);
  if (!comps.length) return null;
  comps.sort((a, b) => b.n - a.n);
  const main = comps[0];
  const box = { x0: main.x0, y0: main.y0, x1: main.x1, y1: main.y1 };
  for (const c of comps.slice(1)) {
    // measured against the main piece, never against the growing box: one
    // touching stroke must not walk the crop down onto a caption
    if (!overlaps(c, main)) continue;
    box.x0 = Math.min(box.x0, c.x0);
    box.y0 = Math.min(box.y0, c.y0);
    box.x1 = Math.max(box.x1, c.x1);
    box.y1 = Math.max(box.y1, c.y1);
  }
  return box;
}

/**
 * Which pixels are the object itself, as opposed to its shadow.
 *
 * This is the distinction the coverage mask cannot make. Most of these
 * sources are cut-outs with a soft drop shadow under the pack, and on a
 * couple of dozen of them the catalogue number sits just below that shadow.
 * The shadow is as wide as the pack, so by coverage the rows beneath the box
 * are every bit as full as the box's own — 0.87 to 0.97 — and no threshold
 * on width can find the bottom edge.
 *
 * Opacity can. The pack is opaque, the shadow is not, and the number is
 * opaque but narrow. Where the source has a real alpha channel that is what
 * gets used; where it does not (the thirty photographed on paper) there is
 * no shadow to confuse anything and the coverage mask is right already.
 */
function solidity(d, w, h, bg, hasAlpha) {
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) continue;
    solid[i] = hasAlpha ? (d[i * 4 + 3] >= SOLID_ALPHA ? 1 : 0) : 1;
  }
  return solid;
}

/**
 * The subject, judged without reference to any flood.
 *
 * `solidity` is derived from a backdrop mask, which makes it useless for
 * checking whether that same mask went wrong — and it does go wrong. Both
 * ESSE Change packs have a pale bevel down the left edge that the flood
 * reaches from the border and eats; the columns it took then look empty, so
 * the trimmed candidate cuts them off, and because the result is still
 * pack-shaped (0.55) nothing downstream objects. The ESSE logo ended up
 * flush against the cut edge.
 *
 * Alpha does not have that problem: where the source is a cut-out, the pack
 * is opaque whatever colour it happens to be. Where it is not a cut-out
 * there is no alpha to use and the plain flood is the best available.
 */
function subjectMask(d, w, h, hasAlpha) {
  if (!hasAlpha) {
    const bg = backdrop(d, w, h, TOLERANCES[0]);
    const out = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) out[i] = bg[i] ? 0 : 1;
    return out;
  }
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4 + 3] >= SOLID_ALPHA ? 1 : 0;
  return out;
}

/**
 * Does this crop end in the middle of the subject rather than at its edge?
 *
 * Sideways only, deliberately. What goes wrong horizontally is the flood
 * eating a pale bevel off the side of a pack — there is nothing but pack to
 * the left of a pack, so a filled column just outside the crop always means
 * the crop is too narrow. Vertically it is ambiguous: below a pack there
 * may be a catalogue number, which is exactly what the earlier passes work
 * to remove, and testing that edge too made three packs pull their captions
 * back in to avoid "cutting" them.
 */
function cutsThrough(subject, w, h, box) {
  const colAt = (x) => {
    let n = 0;
    for (let y = box.y0; y <= box.y1; y++) if (subject[y * w + x]) n++;
    return n / (box.y1 - box.y0 + 1);
  };
  if (box.x0 > 0 && colAt(box.x0 - 1) >= SQUARE_FLOOR) return true;
  if (box.x1 < w - 1 && colAt(box.x1 + 1) >= SQUARE_FLOOR) return true;
  return false;
}

/** Does this source carry a real cut-out, or is it flat on a backdrop? */
function hasCutout(d, w, h) {
  let clear = 0;
  for (let p = 3; p < d.length; p += 4) if (d[p] < 24) clear++;
  return clear / (w * h) >= 0.02;
}

/** Every crop worth considering: two tolerances, each with and without trim. */
function candidates(d, w, h) {
  const out = [];
  for (const tol of TOLERANCES) {
    const flood = { how: `paper>${tol}` };
    const bg = backdrop(d, w, h, tol);
    const box = pieceBox(bg, w, h);
    if (!box) continue;
    out.push({ how: flood.how, bg, box });

    const bw = box.x1 - box.x0 + 1;
    const rows = new Float32Array(h);
    for (let y = box.y0; y <= box.y1; y++) {
      let n = 0;
      for (let x = box.x0; x <= box.x1; x++) if (!bg[y * w + x]) n++;
      rows[y] = n / bw;
    }
    const ry = solidRun(rows, box.y0, box.y1);
    if (!ry) continue;
    const bh = ry[1] - ry[0] + 1;
    const cols = new Float32Array(w);
    for (let x = box.x0; x <= box.x1; x++) {
      let n = 0;
      for (let y = ry[0]; y <= ry[1]; y++) if (!bg[y * w + x]) n++;
      cols[x] = n / bh;
    }
    const rx = solidRun(cols, box.x0, box.x1);
    if (!rx) continue;
    out.push({
      how: `${flood.how}+solid`,
      bg,
      box: { x0: rx[0], y0: ry[0], x1: rx[1], y1: ry[1] },
    });
  }
  return out;
}

const area = (b) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
const ratio = (b) => (b.x1 - b.x0 + 1) / (b.y1 - b.y0 + 1);

/**
 * Square the crop off against the box's own edges.
 *
 * The last thing to come off is the clipped top of a catalogue number. On
 * a couple of dozen packs the number sits directly under the box with the
 * drop shadow running into it, so there is no clean gap to find and no
 * separate component to drop — the density just tapers from the box, through
 * the shadow, into the digits, and the earlier passes keep the lot.
 *
 * A box is a rectangle, though. Every row through it spans essentially the
 * same width, so the box's own median row is the reference, and the first
 * row at either end that falls short of it is where the box stops. Rows
 * beyond that are shadow, or a number, or the top of one.
 *
 * The measurement has to be made against the backdrop mask, never against
 * the finished picture: the ground is painted the page's white, so a white
 * pack read by colour looks like no pack at all. Measured this way the
 * reference sits at 1.0 for almost every pack; measured by colour it fell to
 * 0.39 for ESSE Blue and the trim ate a third of it.
 *
 * The cap is the safety line. Nothing here may take more than SQUARE_MAX off
 * an end, so a pack this reasoning does not suit loses a sliver rather than
 * a third of itself.
 */
function squareOff(solid, w, h, box) {
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const dens = new Float32Array(bh);
  for (let y = box.y0; y <= box.y1; y++) {
    let n = 0;
    for (let x = box.x0; x <= box.x1; x++) if (solid[y * w + x]) n++;
    dens[y - box.y0] = n / bw;
  }
  // Measured against the box's own middle. These boxes are photographed with
  // a little perspective, so the rows run about 0.99 across the middle and
  // 0.85 at the foot, and the number's sliver below that is 0.3 or less. The
  // cut has to sit between those, and the cap decides how far it may run.
  // An absolute floor, not a share of the box's own middle. A catalogue
  // number is a narrow mark — 0.2 or 0.3 of the width — while anything that
  // is really the pack spans nearly all of it, including the white warning
  // panel that Mevius and the Chinese packs carry along their foot. Judged
  // against the median instead, those panels came out short of it and got
  // cut: Mevius lost "Smoking kills" and Septwolves lost its silver top.
  const cap = Math.floor(bh * SQUARE_MAX);

  let top = 0;
  while (top < cap && dens[top] < SQUARE_FLOOR) top++;
  let bottom = 0;
  while (bottom < cap && dens[bh - 1 - bottom] < SQUARE_FLOOR) bottom++;
  if (!top && !bottom) return { box, trimmed: 0 };
  return {
    box: { x0: box.x0, y0: box.y0 + top, x1: box.x1, y1: box.y1 - bottom },
    trimmed: top + bottom,
  };
}

/** Of the box-shaped crops, the smallest — with a floor. See the header. */
function chooseBox(cands, subject, w, h) {
  const plain = cands[0];
  const fits = cands.filter((c) => ratio(c.box) >= AR_MIN && ratio(c.box) <= AR_MAX);
  if (!fits.length) return { ...plain, boxShaped: false };
  const floor = Math.max(...fits.map((c) => area(c.box))) * KEEP;
  const kept = fits.filter((c) => area(c.box) >= floor);
  kept.sort((a, b) => area(a.box) - area(b.box));
  // Smallest wins, but only among crops that stop at the subject's edge
  // rather than through it. Without this the ESSE packs took the crop that
  // had lost their pale left bevel to the flood, because it was the
  // smallest and it was still pack-shaped.
  const clean = kept.filter((c) => !cutsThrough(subject, w, h, c.box));
  if (clean.length) return { ...clean[0], boxShaped: true };
  return { ...kept[kept.length - 1], boxShaped: true };
}

/**
 * Give back anything the crop cut through.
 *
 * The trimmed candidates cut to the longest run of solidly-filled rows, and
 * on a pack whose lower third is a pale warning panel that run can stop
 * short of the pack's own foot. Mevius lost "Smoking kills" that way and
 * Septwolves lost its silver top — the crop ended in the middle of the
 * pack, not at the end of it.
 *
 * So after a box is chosen, each edge is pushed back out for as long as the
 * next row or column along is still substantially filled. A caption stops it
 * immediately, being narrow; the rest of a pack does not. It can never grow
 * past the plain crop, which is the whole of the subject.
 */
function unclip(solid, w, h, box, limit) {
  const rowAt = (y, x0, x1) => {
    let n = 0;
    for (let x = x0; x <= x1; x++) if (solid[y * w + x]) n++;
    return n / (x1 - x0 + 1);
  };
  const colAt = (x, y0, y1) => {
    let n = 0;
    for (let y = y0; y <= y1; y++) if (solid[y * w + x]) n++;
    return n / (y1 - y0 + 1);
  };
  const out = { ...box };
  let moved = 0;
  // sideways only, for the reason given on cutsThrough
  while (out.x0 > limit.x0 && colAt(out.x0 - 1, out.y0, out.y1) >= SQUARE_FLOOR) {
    out.x0--;
    moved++;
  }
  while (out.x1 < limit.x1 && colAt(out.x1 + 1, out.y0, out.y1) >= SQUARE_FLOOR) {
    out.x1++;
    moved++;
  }
  return { box: out, moved };
}

/** "12. 555 — Icy Shine Slim" -> [12, "555 — Icy Shine Slim"] */
function readMenu() {
  const byNumber = new Map();
  for (const line of readFileSync(MENU, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(\d+)\.\s*(.+?)\s*$/.exec(line);
    if (m) byNumber.set(Number(m[1]), m[2]);
  }
  return byNumber;
}

const menu = readMenu();
const files = readdirSync(SRC)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort(
    (a, b) =>
      Number(a.match(/^\d+/)?.[0] ?? 0) - Number(b.match(/^\d+/)?.[0] ?? 0) ||
      a.localeCompare(b),
  );

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];
let bytes = 0;
let trimmed = 0;
let squared = 0;
let handed = 0;
let unclipped = 0;
const unresolved = [];

for (const file of files) {
  const id = file.replace(/\.(png|jpe?g)$/i, '');
  const number = Number(id.match(/^\d+/)?.[0] ?? NaN);

  const { data, info } = await sharp(`${SRC}/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  const cands = candidates(data, w, h);
  if (!cands.length) throw new Error(`${file}: nothing left after clearing the backdrop`);
  const cutout = hasCutout(data, w, h);
  const subject = subjectMask(data, w, h, cutout);
  const chosen = chooseBox(cands, subject, w, h);
  const { bg, how, boxShaped } = chosen;
  const byHand = HAND_CROP[id];
  const solid = solidity(data, w, h, bg, cutout);
  const squaredResult = squareOff(solid, w, h, byHand ?? chosen.box);
  // Squaring off is held to the same standard as the crop itself: if it
  // takes a box-shaped crop and leaves something that is not box-shaped, it
  // has cut into the box and is thrown away. Fiit Menthol went to 1.34
  // without this.
  const base = byHand ?? chosen.box;
  const keepSquared =
    !byHand &&
    squaredResult.trimmed > 0 &&
    (ratio(squaredResult.box) >= AR_MIN && ratio(squaredResult.box) <= AR_MAX ||
      !(ratio(base) >= AR_MIN && ratio(base) <= AR_MAX));
  const squaredBox = keepSquared ? squaredResult.box : base;
  if (keepSquared) squared++;
  if (byHand) handed++;
  // a hand-measured rectangle is the answer; nothing grows it back
  const repaired = byHand
    ? { box: squaredBox, moved: 0 }
    : unclip(subject, w, h, squaredBox, cands[0].box);
  const box = repaired.box;
  if (repaired.moved) unclipped++;

  // paint the backdrop the page's own white, so nothing reads as a panel
  for (let i = 0; i < bg.length; i++) {
    if (!bg[i]) continue;
    const p = i * 4;
    data[p] = GROUND.r;
    data[p + 1] = GROUND.g;
    data[p + 2] = GROUND.b;
    data[p + 3] = 255;
  }

  const region = {
    left: box.x0,
    top: box.y0,
    width: box.x1 - box.x0 + 1,
    height: box.y1 - box.y0 + 1,
  };
  if (byHand) {
    // measured by eye; the automatic reasoning does not apply
  } else if (!boxShaped) {
    unresolved.push(
      `${id} — ${region.width}x${region.height}, ratio ${ratio(box).toFixed(2)}; left alone`,
    );
  } else if (how !== cands[0].how) {
    trimmed++;
  }

  // one height for every box; the width follows the box's own proportions,
  // rounded so the drawn box lands on whole pixels
  const drawnW = Math.max(1, Math.round((region.width / region.height) * DRAWN_H));

  const webp = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract(region)
    .resize({ width: drawnW * SS, height: DRAWN_H * SS, fit: 'fill' })
    // opaque: the ground is the page's white, so there is no alpha to keep
    .flatten({ background: GROUND })
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();

  const title = (menu.get(number) ?? id).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${drawnW}" height="${DRAWN_H}" viewBox="0 0 ${drawnW} ${DRAWN_H}">` +
    `<title>${title}</title>` +
    `<image x="0" y="0" width="${drawnW}" height="${DRAWN_H}" ` +
    `xlink:href="data:image/webp;base64,${webp.toString('base64')}"/>` +
    `</svg>\n`;

  writeFileSync(`${OUT_DIR}/${id}.svg`, svg);
  bytes += svg.length;

  manifest.push({
    id,
    name: menu.get(number) ?? id.replace(/^\d+_/, '').replace(/[-_]/g, ' '),
    w: drawnW,
    h: DRAWN_H,
  });
}

writeFileSync(
  MANIFEST,
  `${JSON.stringify(
    {
      note: 'Generated by npm run build:cigs — do not edit by hand.',
      drawnHeight: DRAWN_H,
      scale: SS,
      count: manifest.length,
      packs: manifest,
    },
    null,
    2,
  )}\n`,
);

const widths = manifest.map((m) => m.w).sort((a, b) => a - b);
console.log(`${manifest.length} packs -> ${OUT_DIR} (${Math.round(bytes / 1024)}KB)`);
console.log(`  ${trimmed} needed more than the plain crop; ${squared} squared off at an edge; ${handed} cropped by hand; ${unclipped} grown back to the pack's own edge`);
console.log(`  widths ${widths[0]}..${widths[widths.length - 1]} at height ${DRAWN_H}`);
if (unresolved.length) {
  console.log(`  ${unresolved.length} found no box-shaped crop and were left alone:`);
  for (const u of unresolved) console.log(`    ${u}`);
}
console.log(`wrote ${MANIFEST}`);
