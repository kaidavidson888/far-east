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

/** Every crop worth considering: two tolerances, each with and without trim. */
function candidates(d, w, h) {
  const out = [];
  for (const tol of TOLERANCES) {
    const bg = backdrop(d, w, h, tol);
    const box = pieceBox(bg, w, h);
    if (!box) continue;
    out.push({ how: `paper>${tol}`, bg, box });

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
      how: `paper>${tol}+solid`,
      bg,
      box: { x0: rx[0], y0: ry[0], x1: rx[1], y1: ry[1] },
    });
  }
  return out;
}

const area = (b) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1);
const ratio = (b) => (b.x1 - b.x0 + 1) / (b.y1 - b.y0 + 1);

/** Of the box-shaped crops, the smallest — with a floor. See the header. */
function chooseBox(cands) {
  const plain = cands[0];
  const fits = cands.filter((c) => ratio(c.box) >= AR_MIN && ratio(c.box) <= AR_MAX);
  if (!fits.length) return { ...plain, boxShaped: false };
  const floor = Math.max(...fits.map((c) => area(c.box))) * KEEP;
  const kept = fits.filter((c) => area(c.box) >= floor);
  kept.sort((a, b) => area(a.box) - area(b.box));
  return { ...kept[0], boxShaped: true };
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
  const { bg, box, how, boxShaped } = chooseBox(cands);

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
  if (!boxShaped) {
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
console.log(`  ${trimmed} needed more than the plain crop`);
console.log(`  widths ${widths[0]}..${widths[widths.length - 1]} at height ${DRAWN_H}`);
if (unresolved.length) {
  console.log(`  ${unresolved.length} found no box-shaped crop and were left alone:`);
  for (const u of unresolved) console.log(`    ${u}`);
}
console.log(`wrote ${MANIFEST}`);
