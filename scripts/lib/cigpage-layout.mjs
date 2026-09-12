/**
 * The cigarette page, rearranged.
 *
 * The owner asked for two things. The title block — brand, variant, full
 * name — moves up under the 遠東 logo and takes the left edge the landing
 * page's OFFERS button has, which is three pixels in from the logo's own.
 * Everything below it keeps the *ratio* of the gaps between the bands but
 * spreads down the whole page instead of stopping three quarters of the way.
 *
 * WHY BANDS RATHER THAN ELEMENTS. Each vector is a flat list of rects,
 * images and texts with absolute coordinates — no groups, no ids. But all
 * 227 of them lay the page out the same way, in six horizontal bands that
 * never interleave (surveyed: two shapes, differing only by one rect in the
 * ratings band, and every element in exactly one band in every file). So the
 * move is done by wrapping each band's run of elements in a <g translate>
 * and leaving every coordinate inside it alone. Nothing is re-typed, so
 * nothing can be mistyped.
 *
 * WHY THE FRAME IS FIXED AND NOT MEASURED. The body is centred on the page
 * while the logo is pinned to the page's edge, so the two only line up at
 * the design's own width — and the title has to line up with the logo. If
 * the crop were measured off the ink, moving the title would move the crop,
 * which would move the title: the alignment would chase itself. So the crop
 * is the design's own frame (x=39, the width the logo used to start at) and
 * the arithmetic is stable. At 390 wide the body lands at stage x=43, which
 * puts vector x=44 at stage x=48 — the logo's 45 plus the OFFERS 3.
 */
import { readFileSync } from 'node:fs';

const ink = JSON.parse(readFileSync('scripts/assets/far-east-ink.json', 'utf8'));

/** The design's own page and its frame within it. */
export const PAGE = { w: 390, h: 844 };
/** Top margin from the design; the foot gets the same, so it spreads evenly. */
export const MARGIN = 18;
export const FRAME = { x: 39, y: MARGIN, w: 304, h: PAGE.h - MARGIN * 2 };

/** Where the landing page puts OFFERS, which is where the title block goes. */
const OFFERS = { x: 48, y: 161 };
/** The logo, as the page draws it, and the body's left edge at design width. */
const LOGO_STAGE_X = 45;
const BODY_STAGE_X = (PAGE.w - FRAME.w) / 2; // 43
/** vector x -> stage x at the design width. */
const toStage = (x) => x - FRAME.x + BODY_STAGE_X;
const fromStage = (x) => x - BODY_STAGE_X + FRAME.x;

/** The title's left edge, in the vector's own coordinates. */
export const TITLE_X = fromStage(LOGO_STAGE_X + (OFFERS.x - LOGO_STAGE_X)); // 44
/** The title's ink top, likewise. */
export const TITLE_TOP = OFFERS.y;

/** The bands, in the order they appear down the page. */
const BANDS = [
  { id: 'head', y0: 0, y1: 150 },
  { id: 'title', y0: 150, y1: 262 },
  { id: 'pack', y0: 262, y1: 440 },
  { id: 'rating', y0: 440, y1: 540 },
  { id: 'clouds', y0: 540, y1: 580 },
  { id: 'comments', y0: 580, y1: 745 },
];
/** The ones that move. `head` is the stripped logo and seal and the ground. */
const MOVING = ['title', 'pack', 'rating', 'clouds', 'comments'];

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
    found.push({ name, tag, band: band.id, at: m.index, end: m.index + tag.length, ext: extentOf(name, tag) });
  }

  const bands = new Map();
  for (const el of found) {
    if (!bands.has(el.band)) bands.set(el.band, { id: el.band, els: [], top: Infinity, bottom: -Infinity });
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
    if (!Number.isFinite(b.top)) throw new Error(`${label}: the ${b.id} band has no measurable element`);
    b.from = b.els[0].at;
    b.to = b.els[b.els.length - 1].end;
  }
  return bands;
}

/**
 * Where each band should go.
 *
 * The title lands on OFFERS. What is left of the page is shared out among
 * the bands below it: each keeps its own height, and the gaps between them
 * keep their ratio to one another and take up whatever is left.
 */
export function planMoves(bands, label = 'page') {
  const order = MOVING.filter((id) => bands.has(id));
  const title = bands.get('title');
  if (!title) throw new Error(`${label}: no title band`);

  const moves = new Map();
  moves.set('title', { dx: TITLE_X - leftOf(title), dy: TITLE_TOP - title.top });

  const rest = order.filter((id) => id !== 'title').map((id) => bands.get(id));
  const titleBottom = title.bottom + (TITLE_TOP - title.top);

  const gaps = [];
  let prevBottom = title.bottom;
  for (const b of rest) {
    gaps.push(b.top - prevBottom);
    prevBottom = b.bottom;
  }
  const heights = rest.map((b) => b.bottom - b.top);

  const room = FRAME.y + FRAME.h - titleBottom;
  const forGaps = room - heights.reduce((a, b) => a + b, 0);
  const gapSum = gaps.reduce((a, b) => a + b, 0);
  if (forGaps <= 0) throw new Error(`${label}: no room left for the gaps`);
  const k = forGaps / gapSum;

  let y = titleBottom;
  rest.forEach((b, i) => {
    y += gaps[i] * k;
    moves.set(b.id, { dx: 0, dy: y - b.top });
    y += heights[i];
  });
  return { moves, k };
}

/** The leftmost edge a band's elements start at. */
function leftOf(band) {
  let x = Infinity;
  for (const el of band.els) {
    const v = num(el.tag, 'x');
    if (v !== null && v < x) x = v;
  }
  return x;
}

/** Wrap each band in its own translate, without touching a coordinate. */
export function applyMoves(svg, bands, moves) {
  const runs = [...bands.values()]
    .filter((b) => moves.has(b.id))
    .map((b) => ({ ...b, move: moves.get(b.id) }))
    .sort((a, b) => b.from - a.from); // back to front, so offsets hold

  let out = svg;
  for (const run of runs) {
    const { dx, dy } = run.move;
    if (!dx && !dy) continue;
    const open = `<g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)})">`;
    out = out.slice(0, run.from) + open + out.slice(run.from, run.to) + '</g>' + out.slice(run.to);
  }
  return out;
}

/** The whole rearrangement, and the numbers it used. */
export function relayout(svg, label = 'page') {
  const bands = readBands(svg, label);
  const { moves, k } = planMoves(bands, label);
  return { svg: applyMoves(svg, bands, moves), bands, moves, k };
}
