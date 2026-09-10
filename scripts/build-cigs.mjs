/**
 * Turns the supplied pack photographs into page-ready marks.
 *
 *   npm run build:cigs
 *
 * The owner supplied 282 pack images of wildly mixed provenance: 1024 square
 * renders with alpha, phone-sized JPEGs on white, a handful of 300px
 * thumbnails. This levels them into one set that the scroller can lay out
 * without thinking about any of that:
 *
 *   - transparent ground. Most already have one. The thirty that do not are
 *     on white, so the white is flood-filled from the border rather than
 *     keyed globally — a pack's own white panels are not connected to the
 *     edge, so they survive. (A global key eats the label off half of them.)
 *   - trimmed to the pack. Every source pads differently; after trimming,
 *     position is the layout's business, not the image's.
 *   - one height, natural width. The design draws packs at 90-94 high and
 *     53-63 wide, i.e. a common height with the width following the pack's
 *     own proportions, and the set's aspect ratios sit in the same band
 *     (median 0.63). So height is fixed and width falls out.
 *
 * WHY SVG. The owner asked for SVGs. These are photographs, so there is no
 * sensible vector to trace to — a trace of a pack render is both enormous
 * and worse-looking than the photograph. What an SVG buys here is the thing
 * the rest of the site's marks have: one self-contained file per pack, named
 * for its source, that scales and can be dropped anywhere. So each is an SVG
 * wrapping its own trimmed, transparent WebP at 3x, which costs about a
 * third more bytes than the bare WebP and is worth it for one artefact per
 * pack rather than two.
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

/** Near-white, and flat enough to be a backdrop rather than a pack panel. */
const isPaper = (d, p) =>
  d[p] > 233 &&
  d[p + 1] > 233 &&
  d[p + 2] > 233 &&
  Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]) < 14;

/**
 * Clear the backdrop by flooding in from the border.
 *
 * Connectivity is the whole point: a pack's white panel is enclosed by its
 * own edges, so the flood never reaches it. Keying every white pixel in the
 * image instead punches the labels out.
 */
function clearBackdrop(d, w, h) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const i = y * w + x;
    if (seen[i]) return;
    if (!isPaper(d, i * 4)) return;
    seen[i] = 1;
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
  let n = 0;
  for (let i = 0; i < seen.length; i++)
    if (seen[i]) {
      d[i * 4 + 3] = 0;
      n++;
    }
  return n;
}

/** Does this image already carry a cut-out, or is it flat on a backdrop? */
function hasCutout(d, w, h) {
  let clear = 0;
  for (let p = 3; p < d.length; p += 4) if (d[p] < 16) clear++;
  return clear / (w * h) >= 0.02;
}

function inkBox(d, w, h) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
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
  .sort((a, b) => (Number(a.match(/^\d+/)?.[0] ?? 0) - Number(b.match(/^\d+/)?.[0] ?? 0)) || a.localeCompare(b));

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];
let keyed = 0;
let bytes = 0;
let unnamed = 0;

for (const file of files) {
  const id = file.replace(/\.(png|jpe?g)$/i, '');
  const number = Number(id.match(/^\d+/)?.[0] ?? NaN);

  const { data, info } = await sharp(`${SRC}/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (!hasCutout(data, info.width, info.height)) {
    clearBackdrop(data, info.width, info.height);
    keyed++;
  }

  const box = inkBox(data, info.width, info.height);
  if (!box) throw new Error(`${file}: nothing left after clearing the backdrop`);

  // one height for every pack; the width follows the pack's own proportions,
  // rounded so the drawn box lands on whole pixels
  const drawnW = Math.max(1, Math.round((box.width / box.height) * DRAWN_H));

  const webp = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .extract(box)
    .resize({ width: drawnW * SS, height: DRAWN_H * SS, fit: 'fill' })
    .webp({ quality: QUALITY, effort: 6, alphaQuality: 100 })
    .toBuffer();

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${drawnW}" height="${DRAWN_H}" viewBox="0 0 ${drawnW} ${DRAWN_H}">` +
    `<title>${(menu.get(number) ?? id).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>` +
    `<image x="0" y="0" width="${drawnW}" height="${DRAWN_H}" ` +
    `xlink:href="data:image/webp;base64,${webp.toString('base64')}"/>` +
    `</svg>\n`;

  writeFileSync(`${OUT_DIR}/${id}.svg`, svg);
  bytes += svg.length;

  const name = menu.get(number);
  if (!name) unnamed++;
  manifest.push({ id, name: name ?? id.replace(/^\d+_/, '').replace(/[-_]/g, ' '), w: drawnW, h: DRAWN_H });
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

console.log(`${manifest.length} packs -> ${OUT_DIR} (${Math.round(bytes / 1024)}KB)`);
console.log(`  backdrop cleared on ${keyed}; ${unnamed} without a menu name`);
const widths = manifest.map((m) => m.w).sort((a, b) => a - b);
console.log(`  widths ${widths[0]}..${widths[widths.length - 1]} at height ${DRAWN_H}`);
console.log(`wrote ${MANIFEST}`);
