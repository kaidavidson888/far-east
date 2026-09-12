/**
 * The cigarette page's title block, aligned.
 *
 * The owner asked for one change to the supplied design: the title block —
 * brand, variant, full name — moves up under the 遠東 logo and takes the left
 * edge the landing page's OFFERS button has, which is three pixels in from
 * the logo's own. Its three lines keep their spacing relative to each other.
 * Everything else on the page stays exactly where it was drawn.
 *
 * WHY A BAND RATHER THAN THREE ELEMENTS. Each vector is a flat list of rects,
 * images and texts with absolute coordinates — no groups, no ids — but all
 * 227 of them lay the page out the same way, in six horizontal bands that
 * never interleave (surveyed: two shapes, differing only by one rect in the
 * ratings band, and every element in exactly one band in every file). So the
 * title's three lines are found by where they sit, and moved by wrapping
 * their run in a <g translate>, leaving every coordinate inside it alone.
 * Nothing is re-typed, so nothing can be mistyped.
 *
 * WHERE IT LANDS. The body is cut to the design's own frame and centred by
 * the page, so at the design's 390 the body sits at stage x=43 and vector
 * x=44 falls on stage x=48 — the logo's 45 plus the OFFERS 3. The frame is
 * fixed rather than measured off the ink for exactly this reason: a crop that
 * followed the ink would move when the title moved, which would move the
 * title, and the alignment would chase itself.
 */
import { readFileSync } from 'node:fs';

const ink = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));

/** The design's own page, and the frame the body is cut to within it. */
export const PAGE = { w: 390, h: 844 };
export const FRAME = { x: 39, y: 18, w: 304, h: 712 };

/** Where the landing page puts OFFERS, which is where the title block goes. */
const OFFERS = { x: 48, y: 161 };
/** The logo as the page draws it, and the body's left edge at design width. */
const LOGO_STAGE_X = 45;
const BODY_STAGE_X = (PAGE.w - FRAME.w) / 2; // 43
const fromStage = (x) => x - BODY_STAGE_X + FRAME.x;

/** The title's left edge and ink top, in the vector's own coordinates. */
export const TITLE_X = fromStage(LOGO_STAGE_X + (OFFERS.x - LOGO_STAGE_X)); // 44
export const TITLE_TOP = OFFERS.y;

/** The bands, in the order they appear down the page. Only one moves. */
const BANDS = [
  { id: 'head', y0: 0, y1: 150 },
  { id: 'title', y0: 150, y1: 262 },
  { id: 'pack', y0: 262, y1: 440 },
  { id: 'rating', y0: 440, y1: 540 },
  { id: 'clouds', y0: 540, y1: 580 },
  { id: 'comments', y0: 580, y1: 745 },
];

const ELEMENT = /<(rect|image|text|path|line)\b[^>]*(\/>|>[\s\S]*?<\/\1>)/g;

const num = (tag, k) => {
  const m = new RegExp(`\\s${k}="([-0-9.]+)"`).exec(tag);
  return m ? parseFloat(m[1]) : null;
};

const decode = (s) =>
  s
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&#x2019;/g, '’')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/** How far a string's ink reaches above and below its baseline, per em. */
export function textInk(str) {
  let a = 0;
  let d = 0;
  for (const ch of str) {
    const up = ink.asc[ch] ?? ink.fb[ch]?.a ?? ink.asc.o;
    const down = ink.desc[ch] ?? ink.fb[ch]?.d ?? 0;
    if (up > a) a = up;
    if (down > d) d = down;
  }
  return { asc: a / ink.em, desc: d / ink.em };
}

/** What one element occupies vertically, or null if it rides along. */
function extentOf(name, tag) {
  if (name === 'rect' || name === 'image') {
    const y = num(tag, 'y');
    const h = num(tag, 'height');
    if (y === null || h === null) return null;
    return { top: y, bottom: y + h };
  }
  if (name === 'text') {
    const y = num(tag, 'y');
    const size = num(tag, 'font-size');
    if (y === null || size === null) return null;
    const body = decode(tag.replace(/^<text\b[^>]*>/, '').replace(/<\/text>$/, ''));
    const { asc, desc } = textInk(body);
    return { top: y - asc * size, bottom: y + desc * size };
  }
  // <path> and <line> are always inside a box in their own band, so they
  // ride along without ever setting the band's edge
  return null;
}

/** Which band an element declares itself into. */
function bandOf(name, tag) {
  let y = num(tag, 'y');
  if (y === null) y = num(tag, 'y1');
  if (y === null && name === 'path') {
    const d = /\sd="M\s*([-0-9.]+)[ ,]+([-0-9.]+)/.exec(tag);
    y = d ? parseFloat(d[2]) : null;
  }
  if (y === null) return null;
  return BANDS.find((b) => y >= b.y0 && y < b.y1) ?? null;
}

/** Read the page: every element, its band, and where each band reaches. */
export function readBands(svg, label = 'page') {
  const found = [];
  for (const m of svg.matchAll(ELEMENT)) {
    const tag = m[0];
    const name = /^<([a-z]+)/.exec(tag)[1];
    // the white ground is the page itself, not part of any band
    if (name === 'rect' && num(tag, 'width') === PAGE.w) continue;
    const band = bandOf(name, tag);
    if (!band) throw new Error(`${label}: <${name}> in no band`);
    found.push({
      name,
      tag,
      band: band.id,
      at: m.index,
      end: m.index + tag.length,
      ext: extentOf(name, tag),
    });
  }

  const bands = new Map();
  for (const el of found) {
    if (!bands.has(el.band)) {
      bands.set(el.band, { id: el.band, els: [], top: Infinity, bottom: -Infinity });
    }
    const b = bands.get(el.band);
    b.els.push(el);
    if (el.ext) {
      if (el.ext.top < b.top) b.top = el.ext.top;
      if (el.ext.bottom > b.bottom) b.bottom = el.ext.bottom;
    }
  }

  // every band has to be one unbroken run, or wrapping it would reorder the page
  for (const b of bands.values()) {
    const first = found.indexOf(b.els[0]);
    const last = found.indexOf(b.els[b.els.length - 1]);
    if (last - first + 1 !== b.els.length) {
      throw new Error(`${label}: the ${b.id} band is interleaved with another`);
    }
    if (!Number.isFinite(b.top)) {
      throw new Error(`${label}: the ${b.id} band has no measurable element`);
    }
    b.from = b.els[0].at;
    b.to = b.els[b.els.length - 1].end;
  }
  return bands;
}

/**
 * Move the title block, and only the title block.
 *
 * Its ink top goes to OFFERS' own y and its left edge to OFFERS' own x. The
 * three lines travel together inside one translate, so the spacing the owner
 * drew between them is carried across untouched.
 */
export function alignTitle(svg, label = 'page') {
  const bands = readBands(svg, label);
  const title = bands.get('title');
  if (!title) throw new Error(`${label}: no title band`);

  let left = Infinity;
  for (const el of title.els) {
    const x = num(el.tag, 'x');
    if (x !== null && x < left) left = x;
  }
  if (!Number.isFinite(left)) throw new Error(`${label}: the title band has no x`);

  const dx = TITLE_X - left;
  const dy = TITLE_TOP - title.top;
  if (!dx && !dy) return { svg, dx, dy };

  const open = `<g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">`;
  const moved =
    svg.slice(0, title.from) +
    open +
    svg.slice(title.from, title.to) +
    '</g>' +
    svg.slice(title.to);
  return { svg: moved, dx, dy };
}

/**
 * The gap between the brand line and the flavour line of the title block.
 *
 * The owner asked for the rule round the info to stand off it by the same
 * distance, and that distance is not a constant: every line on these pages is
 * sized to its own phrase, so the gap runs from 14px to 28px across the set
 * (median 19). So it is measured per page rather than picked once.
 *
 * Ink to ink — the bottom of the brand's lowest descender to the top of the
 * flavour's tallest ascender — because that is the gap you actually see.
 */
export function titleGap(svg, label = 'page') {
  const bands = readBands(svg, label);
  const title = bands.get('title');
  if (!title) throw new Error(`${label}: no title band`);
  const lines = title.els
    .filter((el) => el.name === 'text' && el.ext)
    .sort((a, b) => a.ext.top - b.ext.top);
  if (lines.length < 2) throw new Error(`${label}: the title block has ${lines.length} line(s)`);
  return lines[1].ext.top - lines[0].ext.bottom;
}
