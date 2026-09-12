/**
 * Measures the shelf page's design and writes lib/shelf-geometry.json.
 *
 *   npm run build:shelf
 *
 * The design (scripts/assets/shelf-mobile.svg, the owner's export) is five
 * identical rows under a logo and a header: a pack in a red rule, a plus box,
 * a bookmark box, a quantity box, a black comment panel and five clouds. The
 * page is NOT cut into parts like the other artwork pages, because there is
 * nothing in it that needs to be a picture — every mark is a box, a rule, a
 * cloud the site already has, or type, and the owner asked for the type to be
 * re-set in their own face so it comes out sharp. So the build measures where
 * everything is and how big the type is, and the page draws it.
 *
 * MEASURED OFF A RENDER, NOT READ OFF THE NODES. Each node is rasterised on
 * its own — on white, or on black for the white ones — and its ink box read
 * back, the same way split-svg-parts does it. Figma's rects carry odd
 * quarter-pixel sizes (27.4959 x 25.5709 for a box that is plainly meant to
 * match the 27 x 25 beside it) and the type is outlined, so the only honest
 * numbers are the ones the pixels give.
 *
 * ROUNDED TO NEAREST, NOT OUTWARD. Everything on the page has to sit on whole
 * pixels or it blurs, and outward rounding would make the plus box 31 x 29
 * beside a bookmark box of 30 x 28 when the design plainly draws them the
 * same. Nearest keeps matching things matching.
 *
 * ONE ROW IS THE TEMPLATE. The five are the same to the pixel in x; in y they
 * drift down by a pixel a row (126, 127, 128, 129 between them), which is a
 * hand placing them, so the pitch is the median of those gaps, floored to a
 * whole pixel. The page repeats the top row at that pitch for however many
 * packs are on the reader's shelf.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'scripts/assets/shelf-mobile.svg';
const OUT = 'lib/shelf-geometry.json';
const INK = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));

const SS = 4; // supersample, for quarter-pixel ink boxes

/**
 * Where the baseline sits in a `line-height: 1` box set in the owner's face,
 * as a fraction of the font size. Measured in Chrome: fontBoundingBoxAscent
 * 90 and descent 25 at 100px, so the 115px content area overhangs the 100px
 * line box by 7.5 each side and the baseline lands at 90 - 7.5 = 82.5. The
 * page needs it to put a run of type's ink where the design's ink is.
 */
const BASELINE = 0.825;

const svg = readFileSync(SRC, 'utf8');
const at = (tag, k) => {
  const m = tag.match(new RegExp(`${k}="([^"]*)"`));
  return m ? m[1] : null;
};

const head = svg.slice(0, svg.indexOf('>') + 1);
const vb = (at(head, 'viewBox') ?? '0 0 390 844').split(/\s+/).map(Number);
const W = vb[2];
const H = vb[3];
const defsStart = svg.indexOf('<defs>');
const defs = svg.slice(defsStart, svg.indexOf('</defs>') + 7);
const body = svg.slice(head.length, defsStart);

// every drawn node in document order, minus the white ground
const nodes = [...body.matchAll(/<(rect|path)\b[^>]*\/>/g)]
  .map((m) => m[0])
  .filter((n) => !(n.startsWith('<rect') && at(n, 'width') === String(W) && !at(n, 'x')));

/**
 * The design's document order, which is how the nodes are told apart. The
 * header comes first, then twenty nodes a row. This is the shape of THIS
 * export; a re-export that reorders the file will fail the checks below
 * rather than silently mislabel a box.
 */
const HEAD = ['pack', 'pack', 'pack', 'pack', 'pack', 'logo', 'price', 'click', 'headerBox'];
const ROW = [
  'bookmarkBox', 'qtyBox', 'bookmarkBody', 'bookmarkLegA', 'bookmarkLegB', 'plusH', 'plusV',
  'plusBox', 'cloud', 'cloud', 'cloud', 'cloud', 'cloud', 'qtyBacking', 'qtyGhost', 'qty',
  'qtyBackingB', 'panel', 'line1', 'line2',
];
if (nodes.length !== HEAD.length + ROW.length * 5) {
  throw new Error(`expected ${HEAD.length + ROW.length * 5} nodes, found ${nodes.length}`);
}

async function inkBox(node, ground) {
  const doc =
    head.replace(/width="[^"]*" height="[^"]*"/, `width="${W * SS}" height="${H * SS}"`) +
    defs +
    (ground === 'black' ? `<rect width="${W}" height="${H}" fill="black"/>` : '') +
    node +
    '</svg>';
  const bg = ground === 'black' ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
  const { data, info } = await sharp(Buffer.from(doc)).flatten({ background: bg }).raw().toBuffer({ resolveWithObject: true });
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const p = (y * info.width + x) * info.channels;
      const ink = ground === 'black'
        ? data[p] > 10 || data[p + 1] > 10 || data[p + 2] > 10
        : data[p] < 245 || data[p + 1] < 245 || data[p + 2] < 245;
      if (ink) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0 / SS, y: y0 / SS, w: (x1 - x0 + 1) / SS, h: (y1 - y0 + 1) / SS };
}

const round = (b) => ({ x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) });

const measured = [];
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i];
  const name = i < HEAD.length ? HEAD[i] : ROW[(i - HEAD.length) % ROW.length];
  const row = i < HEAD.length ? null : Math.floor((i - HEAD.length) / ROW.length);
  const fill = (at(node, 'fill') ?? '').toLowerCase();
  const ground = fill === 'white' || fill === '#ffffff' ? 'black' : 'white';
  const box = await inkBox(node, ground);
  measured.push({ i, name, row, fill, box });
  process.stdout.write(`  ${String(i).padStart(3)} ${name.padEnd(13)} ${box ? `${box.x},${box.y} ${box.w}x${box.h}` : '(no ink)'}\n`);
}

const one = (name, row = null) => {
  const hits = measured.filter((m) => m.name === name && m.row === row && m.box);
  if (hits.length !== 1) throw new Error(`${name}${row === null ? '' : ` in row ${row}`}: ${hits.length} found, expected 1`);
  return hits[0].box;
};
const all = (name, row) => measured.filter((m) => m.name === name && m.row === row && m.box).map((m) => m.box);

// the top row is the template; rows are in document order, not page order
const rowTops = measured.filter((m) => m.name === 'plusBox' && m.box).map((m) => ({ row: m.row, top: m.box.y }));
rowTops.sort((a, b) => a.top - b.top);
const template = rowTops[0].row;
const gaps = rowTops.slice(1).map((r, k) => r.top - rowTops[k].top);
const sorted = gaps.slice().sort((a, b) => a - b);
const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
const pitch = Math.floor(median);

const packs = measured.filter((m) => m.name === 'pack' && m.box).map((m) => m.box).sort((a, b) => a.y - b.y);
const topFrame = round(packs[0]);
const bookmarkBox = round(one('bookmarkBox', template));
// The plus box is drawn as the bookmark box's twin, but Figma gave it an odd
// size (27.4959 x 25.5709 inside its rule) that measures 30.5 x 28.75 and
// rounds to 31 x 29 beside the bookmark's 30 x 28. Same control, same box:
// it takes its twin's size and keeps its own position.
const plusBox = { ...round(one('plusBox', template)), w: bookmarkBox.w, h: bookmarkBox.h };
const qtyBox = round(one('qtyBox', template));
const panel = round(one('panel', template));
const bookmarkBody = one('bookmarkBody', template);
const legs = [one('bookmarkLegA', template), one('bookmarkLegB', template)];
const bookmark = round({
  x: Math.min(bookmarkBody.x, ...legs.map((l) => l.x)),
  y: bookmarkBody.y,
  w: Math.max(bookmarkBody.x + bookmarkBody.w, ...legs.map((l) => l.x + l.w)) - Math.min(bookmarkBody.x, ...legs.map((l) => l.x)),
  h: Math.max(...legs.map((l) => l.y + l.h)) - bookmarkBody.y,
});
const rowTop = Math.min(plusBox.y, bookmarkBox.y, qtyBox.y, topFrame.y);
const rowBottom = Math.max(panel.y + panel.h, topFrame.y + topFrame.h);

/**
 * How big to set a run of type so its ink is the height the design draws.
 * `by` is the glyphs the design's ink height comes from — the face's own, so
 * a fallback glyph like $ or # never sets the size — and the tallest of them
 * decides: size = inkHeight / (asc / 1000).
 */
const typeRun = (text, by, box) => {
  const asc = Math.max(...[...by].map((c) => INK.asc[c] ?? 0));
  if (!asc) throw new Error(`no ascent for ${JSON.stringify(by)}`);
  return { text, by, ink: round(box), asc, size: +(box.h / (asc / 1000)).toFixed(2) };
};

const geometry = {
  note: 'Generated by npm run build:shelf from scripts/assets/shelf-mobile.svg — do not edit by hand.',
  viewBox: { w: W, h: H },
  background: '#ffffff',
  /** Where the baseline sits in a line-height:1 box, as a fraction of the size. See build-shelf.mjs. */
  baseline: BASELINE,
  /** The design's own logo raster, for reference; the page places the site's vector logo at the landing margins. */
  logoInk: round(one('logo')),
  header: {
    box: { ...round(one('headerBox')), stroke: 3 },
    click: typeRun('Click # When Finished', 'ClickWhenFinished', one('click')),
    price: typeRun('$240', '240', one('price')),
  },
  row: {
    top: rowTop,
    height: rowBottom - rowTop,
    pitch,
    count: rowTops.length,
    /** The top row's rule round its pack, outer edge; the image sits inside it. */
    frame: { ...topFrame, stroke: 5 },
    plusBox: { ...plusBox, stroke: 3 },
    plusH: round(one('plusH', template)),
    plusV: round(one('plusV', template)),
    bookmarkBox: { ...bookmarkBox, stroke: 3 },
    bookmark,
    qtyBox: { ...qtyBox, stroke: 3 },
    qty: typeRun('12x', '12x', one('qty', template)),
    panel,
    line1: typeRun('Leave a comment <3', 'Leaveacomment', one('line1', template)),
    line2: typeRun('-POST-', 'POST', one('line2', template)),
    clouds: all('cloud', template).map(round).sort((a, b) => a.x - b.x),
  },
};

writeFileSync(OUT, `${JSON.stringify(geometry, null, 2)}\n`);
console.log(`\n  rows at ${rowTops.map((r) => r.top).join(', ')} → pitch ${pitch} (gaps ${gaps.join(', ')})`);
console.log(`  row ${rowTop}..${rowBottom} (${rowBottom - rowTop} tall); frame ${topFrame.w}x${topFrame.h}`);
console.log(`  type: price ${geometry.header.price.size}px, click ${geometry.header.click.size}px, qty ${geometry.row.qty.size}px, panel ${geometry.row.line1.size}/${geometry.row.line2.size}px`);
console.log(`  wrote ${OUT}`);
