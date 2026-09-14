import geometry from './shelf-geometry.json';
import landing from './landing-geometry.json';
import type { CigPack } from './cigRow';
import type { PackUnit } from './cigPages';

/**
 * THE SHELF PAGE'S TEMPLATE.
 *
 * The owner supplied a design of five packs on a shelf and asked for it as a
 * page, saved as a template, with the packs replaced by whatever the reader
 * has saved. This is that template: given a list of shelf entries it returns
 * everything the page needs to draw, all of it worked out from the measured
 * geometry in shelf-geometry.json (`npm run build:shelf`) and nothing typed
 * in by hand. Change the design, re-run the build, and the page follows.
 *
 * WHAT HOLDS AND WHAT FLEXES, the same rule as every other artwork page: the
 * left margin is the logo's own; the header hangs from the mirrored right
 * margin; the rows keep the design's distance from the top and from each
 * other, and grow down the page as the shelf does.
 *
 * THE ROWS SIT BETWEEN THE LOGO AND THE $ SIGN. The owner's rule: each row's
 * left edge is the right edge of the character logo, and its right edge the
 * $ sign (sigils excluded), the rows keeping their arrangement. So every
 * pack's rule starts on the row's own left edge (a wider pack grows to the
 * right, into the gap before the boxes), the boxes, panel and clouds keep the
 * design's distance from it, and one zoom lands the second column's panel on
 * the $. The logo is sized to the top pack about its own centre, and the
 * price's box is the logo's band hung from the logo's margins, which makes
 * the span depend on the zoom twice over — see `shelfFit`, which works that
 * out rather than guessing. The design's "Click # When Finished" caption and
 * its box are gone at the owner's ask; the price's own box took their place.
 *
 * THE TYPE IS THE OWNER'S FACE. Every word and number in the design was
 * outlined; the build measured its ink and this sets it in the face at the
 * size that gives the same ink height. Characters the face does not carry —
 * < and the hyphens — fall through to the stack as they do everywhere; the
 * $ and the # are the owner's own now (build:font).
 */
export type ShelfEntry = { pack: CigPack; amount: number | null; unit: PackUnit | null };

const g = geometry;
const LOGO = landing.parts.logo;

/**
 * The margins are symmetric: the aligned right edge holds the same distance
 * from the page's right as the logo holds from its left. The logo is
 * left-anchored in real px, so the right is measured live by the stage
 * (`--aligned-right` = width - SHELF_MARGIN), not a fixed design x.
 */
export const SHELF_MARGIN = LOGO.x;

/** The logo's centre line — the point the logo scales about. */
export const SHELF_AXIS_X = LOGO.x + LOGO.w / 2;
/**
 * The design's row, moved so the pack rule's left edge is x=0 in row
 * coordinates: the row's own left edge, which the page puts on the logo's
 * right. Everything else keeps the design's distance from it.
 */
const DX = -g.row.frame.x;

/**
 * The pack image sits this far inside the rule's outer edge. The design has
 * the image and the rule share one box with the 5px rule straddling its edge,
 * so 2.5px of image is under the rule each side — a half pixel, which blurs.
 * Two whole pixels in, with the rule's inner 3px over the image, is the same
 * 48px of pack showing between the rules.
 */
const INSET = 2;
/** Every pack is drawn this tall, whatever its own height in the row. */
export const SHELF_PACK_H = g.row.frame.h - INSET * 2;

type Box = { x: number; y: number; w: number; h: number };
/** A design box moved into the row's own coordinates, and across by DX. */
const rel = (b: Box) => ({ left: b.x + DX, top: b.y - g.row.top, width: b.w, height: b.h });

/**
 * Where the top of a line-height:1 box goes to put a run's ink top at `inkTop`.
 * The ink of a glyph with ascent `asc` (per 1000) sits (baseline - asc/1000)
 * of the size below the box's top.
 */
const lineTop = (inkTop: number, asc: number, size: number) => inkTop - (g.baseline - asc / 1000) * size;

type Run = { text: string; size: number; asc: number; ink: Box };
const typeAt = (run: Run, x: number) => ({
  size: run.size,
  left: x,
  top: Math.round(lineTop(run.ink.y, run.asc, run.size)) - g.row.top,
});

/**
 * The quantity — "2c", "5p" — centred in its box: equal margins above and
 * below the outline, at the owner's ask. The digit sets the height (its
 * ascent, 688/1000 of the size, is the tallest thing in the run; the letter's
 * x-height sits inside it), so the digit's ink is what is centred between the
 * inside edges of the rule. Placed relative to the inside of the rule, which
 * is where an absolutely placed child of a bordered box is measured from.
 */
const qtyBox = rel(g.row.qtyBox);
const qtyInBox = (() => {
  const stroke = g.row.qtyBox.stroke;
  const innerH = qtyBox.height - stroke * 2;
  const size = g.row.qty.size;
  const inkH = (g.row.qty.asc / 1000) * size;
  const inkTop = (innerH - inkH) / 2;
  // THE p IS SET SMALLER AND LIFTED. At the digit's size its descender ran
  // 1.7px past the inside of the rule — the owner saw it clip. Set so its
  // whole ink, x-height to the foot of the descender, is the digit's ink
  // height, and lifted by that descender, it stands in the digit's own band:
  // the same margins to the rule above and below. The c has no descender and
  // is left as it was.
  const p = g.row.qty.units.p;
  const pSize = +(inkH / (p.asc + p.desc)).toFixed(2);
  return {
    size,
    left: g.row.qty.ink.x + DX - qtyBox.left - stroke,
    top: Math.round(lineTop(inkTop, g.row.qty.asc, size)),
    p: { size: pSize, lift: +(p.desc * pSize).toFixed(2) },
  };
})();

/** The row's fixed furniture, in row coordinates. Computed once. */
export const SHELF_ROW = {
  height: g.row.height,
  pitch: g.row.pitch,
  plusBox: { ...rel(g.row.plusBox), stroke: g.row.plusBox.stroke },
  plusH: rel(g.row.plusH),
  plusV: rel(g.row.plusV),
  bookmarkBox: { ...rel(g.row.bookmarkBox), stroke: g.row.bookmarkBox.stroke },
  bookmark: rel(g.row.bookmark),
  qtyBox: { ...qtyBox, stroke: g.row.qtyBox.stroke },
  /** The quantity, relative to the inside of its box's rule. */
  qty: qtyInBox,
  panel: rel(g.row.panel),
  line1: { ...typeAt(g.row.line1, g.row.line1.ink.x + DX), text: g.row.line1.text },
  line2: { ...typeAt(g.row.line2, g.row.line2.ink.x + DX), text: g.row.line2.text },
  clouds: g.row.clouds.map(rel),
  /** The rule round the pack, and the row's left edge, where every pack's rule starts. */
  rule: g.row.frame.stroke,
  left: 0,
};

/**
 * The price is set bold. The face has one weight, drawn heavy, so "bold" is a
 * stroke laid on the glyphs — the same trick the age gate's title uses. Three
 * hundredths of the size: enough to read as weight, not enough to close the
 * counters of the 0.
 */
export const PRICE_STROKE_EM = 0.03;

/**
 * THE PRICE'S BOX — the owner's later ask, which took the "Click # When
 * Finished" caption and its box off the page: "add a 3px outline in black
 * around the price with the same margins as around the click when finished
 * text", and "scale the price number and its outline up so they have the same
 * top and side margins relative to the page as the character logo".
 *
 * Then, once it was up: "increase the price number outline to 5px and make
 * the side margins equal to the top and bottom. Also align the right side to
 * the right end of the red line."
 *
 * So: a 5px rule — the weight of the red divider, the site's rule; inside it,
 * 11px clear on every side — the clearance the caption had above and below
 * its rule at the design width (which fell out of the caption box's fixed
 * height), now the sides too at the owner's ask; the box's top on the logo's
 * top, its right edge on the red line's right end — the aligned right margin,
 * `width − SHELF_MARGIN`, the same distance in from the page's right as the
 * design's logo stands from its left — and scaled until it is the logo's
 * height, so the two share one band across the head of the page. The size is
 * whatever makes the run's INK, stroke included, fill that box less its
 * margins: the $ rises above the digits and drops below them, and it is the
 * whole run the margins are held to, as they were for the caption. On a
 * narrow page the box would reach the logo first, so it is also held to the
 * room between the logo's right edge (plus the design's own pack-to-boxes
 * gap) and that margin; where that binds the box is shorter than the band,
 * its top still on the logo's. The rows are fitted to the $ sign's left edge
 * as before — now the box's left plus its rule and its clearance, rather than
 * a caption box's edge.
 */
export const PRICE_BOX = {
  rule: 5,
  inset: 11,
  /** Kept between the logo and the box on a narrow page: the design's pack-to-boxes gap. */
  gap: g.row.plusBox.x - (g.row.frame.x + g.row.frame.w),
};

/**
 * The price run's ink per em, stroke excluded: its width, its rise above the
 * baseline, its drop below, and the bearing its first glyph stands in from the
 * element's origin. The table's figures (build:shelf writes `run` from the ink
 * table; the $'s bearing is the face's 56, from build:font's report) are the
 * first paint; the stage measures the run in the page's own face and the box
 * follows. The table's width is the run's ADVANCE, a bearing or so wider than
 * its ink, so the first-paint box is a hair wide until then.
 */
export type PriceMetrics = { em: number; asc: number; desc: number; lsb: number };
const PRICE_LSB_EM = 0.056;

export const SHELF_HEADER = (() => {
  const price = g.header.price;
  return {
    price: {
      text: price.text,
      strokeEm: PRICE_STROKE_EM,
      table: { ...price.run, lsb: PRICE_LSB_EM } as PriceMetrics,
    },
    /** The baseline's place in a line-height:1 box, for the stage to place type by. */
    baseline: g.baseline,
  };
})();

/** The design's own clearance under its last row, held under ours. */
const BOTTOM = g.viewBox.h - (g.row.top + (g.row.count - 1) * g.row.pitch + g.row.height);

/**
 * The row's right edge, in row coordinates: the far edge of the clouds. With
 * the pack's rule at x=0 this is the row's whole width, and what the zoom is
 * worked out against.
 *
 * THE ROWS ARE SCALED WITH `zoom`, NOT `transform: scale`. A transform scales
 * the row's finished pixels, so at 2x the type, the rules and the packs all go
 * soft — the owner saw it. `zoom` lays the row out again at the new size: type
 * is set at the size it shows at, rules are drawn at their zoomed weight, and
 * the packs come from their 3x rasters.
 */
export const CLOUD_RIGHT = Math.max(...SHELF_ROW.clouds.map((c) => c.left + c.width));

/**
 * TWO ENTRIES TO A LINE — the owner's "scale them down again, same
 * parameters, so that two fit in a row". The pair spans the same edges one row
 * did, logo's right to caption box's left, so each is a little under half the
 * width. The gap between the two is the design's own gap between a pack's
 * rule and the boxes beside it (15 at design scale), read off the geometry
 * rather than chosen, so the pair keeps the row's own rhythm. Entries fill
 * left to right, then the next line.
 */
export const SHELF_COLUMNS = 2;
/**
 * The design's own gap between a pack's rule and the boxes beside it — 15.
 * It is the gap between the columns, and it is the standard margin between
 * the widest pack and everything to its right (see shelfLayout).
 */
export const PACK_GAP = g.row.plusBox.x - (g.row.frame.x + g.row.frame.w);
export const COLUMN_GAP = PACK_GAP;
/** Where the boxes start in the design, from the pack rule's left (73). */
const DESIGN_ELEMENTS_X = g.row.plusBox.x - g.row.frame.x;
/** Everything from the first box to the far edge of the clouds: one fixed width. */
export const ELEMENTS_WIDTH = CLOUD_RIGHT - DESIGN_ELEMENTS_X;

/**
 * A ROW IS AS WIDE AS ITS WIDEST PACK ASKS. The owner's rule: every pack in a
 * column centred on one axis, with a standardised margin between the widest
 * and the elements beside it. So the boxes start PACK_GAP past the widest
 * pack's rule, every other pack is centred in the widest one's box, and the
 * row's width is that box plus the gap plus the elements. The design's own
 * frame is 58 wide, which gives the design's own 326. The widest is taken over
 * the whole shelf, so both columns are the same width and their boxes line up.
 */
export const rowWidthFor = (widestPack: number) => widestPack + PACK_GAP + ELEMENTS_WIDTH;
/** From one column's left edge to the next, in row coordinates. */
export const columnPitch = (rowWidth: number) => rowWidth + COLUMN_GAP;

/**
 * THE ROW'S RIGHT EDGE, NOT COUNTING THE SIGILS — the owner's phrase. It is the
 * panel's far edge (233 in the design; the quantity box ends on the same line),
 * and it is what the line is fitted by: "the right edge of each row, not
 * including the sigils, lined up with the $ sign". The clouds run on past it,
 * which is the point of excluding them, and at every width they still end
 * well inside the right margin.
 */
export const BODY_RIGHT = SHELF_ROW.panel.left + SHELF_ROW.panel.width;
const BODY_FROM_ELEMENTS = BODY_RIGHT - DESIGN_ELEMENTS_X;
/** A row's body width for a shelf: the widest pack, the gap, and the boxes to the panel's edge. */
export const bodyWidthFor = (widestPack: number) => widestPack + PACK_GAP + BODY_FROM_ELEMENTS;
/**
 * The line, from the first column's left edge to the LAST column's body edge,
 * in row coordinates: what the zoom is worked out against. The columns before
 * the last are whole (clouds and all, then the gap).
 */
export const gridBodyWidth = (rowWidth: number, bodyWidth: number) =>
  (SHELF_COLUMNS - 1) * columnPitch(rowWidth) + bodyWidth;

/**
 * THE LOGO IS AS WIDE AS THE TOP PACK, about its own centre.
 *
 * The owner's rule: scale the character logo up to the width of the first
 * pack on the page (and so, in proportion, its height), using its current
 * centre as the guide. The pack's width on screen is its row width times the
 * zoom, so this is the stage's to work out; here are the mark's own numbers
 * — its vector's box at the landing margins, and the centre that stays put.
 * With nothing on the shelf there is no top pack, and the logo stays as drawn.
 */
export const SHELF_LOGO = {
  src: '/landing/parts/logo.svg',
  w: LOGO.w,
  h: LOGO.h,
  centreX: LOGO.x + LOGO.w / 2,
  centreY: LOGO.y + LOGO.h / 2,
  /**
   * HOW TALL IT MAY GROW. Scaling about its centre, the mark's top rises as
   * fast as its bottom falls. On a wide screen the rows are zoomed far enough
   * that a pack is over 100px across, and a logo that wide is 250 tall — off
   * the top of the page and down through the divider into the first row. So
   * the height is held to what the header has room for: the top may not
   * leave the page (moot now the page is brought down until the top sits on
   * the margin — see shelfTopShift — but harmless, since the price binds
   * first), and the bottom may not pass the foot of the price's ink, the
   * header's own baseline. Wherever the pack's width fits inside that —
   * every phone and tablet — the logo takes it exactly.
   */
  maxHeight: Math.floor(
    Math.min(2 * (LOGO.y + LOGO.h / 2), 2 * (g.header.price.ink.y + g.header.price.ink.h - (LOGO.y + LOGO.h / 2))),
  ),
};

/**
 * WHERE THE ROWS GO, AND HOW BIG: the fit between the logo and the price's box.
 *
 * The owner's rule — the left edge of each row on the right edge of the
 * character logo, the right edge of each row on the $ sign, the rows keeping
 * their arrangement — is one zoom and one offset: z = span / gridBodyWidth —
 * the line is a whole row, the design's own gap, then a row's BODY, since the
 * owner asked for two to a line and then for the line to end, sigils
 * excluded, on the $ sign — and the first column's x=0 placed on the logo's
 * right.
 *
 * THE SPAN DEPENDS ON THE ZOOM, TWICE OVER. The logo is sized to the top pack,
 * and the top pack's width on screen is its row width times the zoom, so the
 * logo's right edge moves with z:
 *
 *   logoRight = C + (tw · z) / 2         C the logo's centre, tw the top pack's row width
 *   z · G     = dollarLeft − logoRight   G = gridBodyWidth
 *   z         = (dollarLeft − C) / (G + tw / 2)
 *
 * unless the logo's height clamp binds (SHELF_LOGO.maxHeight), when its width
 * is fixed and z = (dollarLeft − C − w/2) / G. And the $ sign's left edge is
 * the price box's, which is the LOGO'S height, its top on the logo's and its
 * right on the aligned margin (PRICE_BOX) — so it moves with the logo, which
 * moves with z. That is no longer one linear equation, so it is iterated:
 * from the tallest logo the clamp allows, the box, then z, then the logo
 * again, until the logo's width comes back unchanged — a few rounds, since a
 * pixel of logo moves the $ by a fraction of a pixel.
 *
 * ON A PHONE THIS RULE HAS NO ROOM. At 375 wide the box's left edge is a
 * hundred-odd pixels from the logo's right — a span that would draw the rows
 * at a fraction of their size. The owner wrote the rule looking at a desktop,
 * where the span is hundreds of pixels. So where it would take the rows below
 * ROW_SCALE_FLOOR the previous phone layout holds instead: one to a line,
 * every pack's rule on the left margin, the rows at FALLBACK_SHRINK of the fit
 * to the right margin; the logo and the price's box are worked out the same
 * way there. THAT SWITCH IS A JUDGEMENT, NOT THE OWNER'S — written here so it
 * can be moved or removed in one place.
 */
export const ROW_SCALE_FLOOR = 0.6;
export const FALLBACK_SHRINK = 0.8;

export type ShelfFit = {
  scale: number;
  /** How many entries sit side by side on a line. */
  cols: number;
  /** The page x the first column's left edge (row x=0) lands on. */
  rowsLeft: number;
  logo: { w: number; h: number; left: number; top: number };
  /** The price's box in page px (its top before the page's shift, like the logo's), and the size the price is set at inside it. */
  box: { left: number; top: number; width: number; height: number; size: number };
  /** The $ sign's left edge: the line the rows are fitted to. */
  dollarLeft: number;
  mode: 'between' | 'fallback';
};

/** The price's box for a logo: the logo's band, its top on the logo's and its right on the aligned margin, held to the room beside the logo. */
function priceBoxFor(width: number, logo: ShelfFit['logo'], price: PriceMetrics) {
  const { rule, inset, gap } = PRICE_BOX;
  // the stroke paints half its width outside the ink on every edge
  const inkW = price.em + PRICE_STROKE_EM;
  const inkH = price.asc + price.desc + PRICE_STROKE_EM;
  const right = width - SHELF_MARGIN;
  const room = right - (logo.left + logo.w + gap) - 2 * (rule + inset);
  const size = +Math.min((logo.h - 2 * (rule + inset)) / inkH, room / inkW).toFixed(2);
  const w = Math.round(inkW * size + 2 * (rule + inset));
  const h = Math.round(inkH * size + 2 * (rule + inset));
  return { left: right - w, top: logo.top, width: w, height: h, size };
}

export function shelfFit(
  width: number,
  price: PriceMetrics,
  topPackWidth: number | null,
  rowWidth: number = CLOUD_RIGHT,
  bodyWidth: number = BODY_RIGHT,
): ShelfFit {
  const C = SHELF_LOGO.centreX;
  const G = gridBodyWidth(rowWidth, bodyWidth);
  const maxW = Math.round((SHELF_LOGO.maxHeight * SHELF_LOGO.w) / SHELF_LOGO.h);
  const logoAt = (w: number) => {
    const h = Math.round((w * SHELF_LOGO.h) / SHELF_LOGO.w);
    return { w, h, left: Math.round(C - w / 2), top: Math.round(SHELF_LOGO.centreY - h / 2) };
  };
  const dollarOf = (box: ShelfFit['box']) => box.left + PRICE_BOX.rule + PRICE_BOX.inset;

  // the tallest logo first; the box, the zoom and the logo then chase each
  // other round until the logo's width holds
  let logo = logoAt(topPackWidth ? maxW : SHELF_LOGO.w);
  let z = 0;
  for (let round = 0; round < 24; round++) {
    const dollarLeft = dollarOf(priceBoxFor(width, logo, price));
    let w: number;
    if (!topPackWidth) {
      // nothing on the shelf: the logo stays as drawn, and the fit is against it
      w = SHELF_LOGO.w;
      z = (dollarLeft - C - w / 2) / G;
    } else {
      z = (dollarLeft - C) / (G + topPackWidth / 2);
      w = Math.round(topPackWidth * z);
      if (w > maxW) {
        w = maxW;
        z = (dollarLeft - C - w / 2) / G;
      }
    }
    if (w === logo.w) break;
    logo = logoAt(w);
  }
  z = +z.toFixed(4);
  if (z >= ROW_SCALE_FLOOR) {
    // the grid starts on the logo's DRAWN right edge — its rounded left plus
    // its width — not on C + w/2, which for an odd width is a half pixel and
    // would put every row's rule on one (the whole-pixel rule)
    const box = priceBoxFor(width, logo, price);
    return { scale: z, cols: SHELF_COLUMNS, rowsLeft: logo.left + logo.w, logo, box, dollarLeft: dollarOf(box), mode: 'between' };
  }

  // the phone layout: one to a line, on the margin
  const alignedRight = width - SHELF_MARGIN;
  const zf = +((FALLBACK_SHRINK * (alignedRight - SHELF_MARGIN)) / rowWidth).toFixed(4);
  const wf = topPackWidth ? Math.min(maxW, Math.round(topPackWidth * zf)) : SHELF_LOGO.w;
  const logoF = logoAt(wf);
  const box = priceBoxFor(width, logoF, price);
  return { scale: zf, cols: 1, rowsLeft: SHELF_MARGIN, logo: logoF, box, dollarLeft: dollarOf(box), mode: 'fallback' };
}

/**
 * HOW FAR THE WHOLE PAGE COMES DOWN. The owner's rule: the logo's top margin
 * is its left margin — the same distance from the page's top edge to the top
 * of the mark as from the left edge to the mark's own left. THE MARK'S OWN
 * LEFT, not the page's 45: the logo scales about its centre, so on a desktop
 * (60 wide, the clamp binding) its left is at 35 and its top at 6, and it is
 * the 35 that is matched; wherever the mark is as drawn, both are 45. Both
 * edges come out of the fit, so the shift does too. Everything on the page —
 * logo, header, divider, rows — moves down by this one amount, so nothing
 * changes relative to anything else.
 */
export const shelfTopShift = (fit: ShelfFit) => fit.logo.left - fit.logo.top;

/** The design's own width sets the first-paint values, before the page measures. */
export const DESIGN_WIDTH = g.viewBox.w;
export const DESIGN_ALIGNED_RIGHT = g.viewBox.w - SHELF_MARGIN;

/**
 * A red rule between the top of the page and the shelf, at the owner's ask.
 *
 * Not in the export — the only red there is the pack rules and the header
 * caption — so it is the site's own red rule (5px, #FF0000). It runs from the
 * left margin to the aligned right edge (its width the page supplies live),
 * halfway down the gap between the $240 and the first row.
 */
export const DIVIDER = {
  colour: '#ff0000',
  height: SHELF_ROW.rule,
  left: SHELF_MARGIN,
  top: Math.round((g.header.price.ink.y + g.header.price.ink.h + g.row.top) / 2 - SHELF_ROW.rule / 2),
};

/**
 * The quantity menu, as the shelf opens it: the same wheels, in the row's own
 * small box. It grows from the plus box's top-left corner (the owner's rule for
 * where the menu comes from) out to the far corner of the comment panel — the
 * row's own outline, with the panel its foot. Three slots tall like the page's,
 * so the pitch is a third of what is inside the rule, and the type is sized to
 * that slot. The row is zoomed, so on a wide screen this is a good deal bigger
 * than these numbers say.
 */
export function shelfQuantityFrame(dx: number) {
  const plus = SHELF_ROW.plusBox;
  const panel = SHELF_ROW.panel;
  const menu = {
    left: plus.left + dx,
    top: plus.top,
    width: panel.left + panel.width - plus.left,
    height: panel.top + panel.height - plus.top,
  };
  const stroke = plus.stroke;
  const pitch = Math.floor((menu.height - stroke * 2) / 3);
  return {
    plus: { left: plus.left + dx, top: plus.top, width: plus.width, height: plus.height },
    menu,
    stroke,
    pitch,
    fontSize: Math.round(pitch * 0.78),
  };
}

export type ShelfRow = {
  key: string;
  /**
   * Its place on the shelf, most recent first. WHERE it lands — which column,
   * which line — is the stylesheet's, from `--cols` and the pitches the stage
   * sets, because the column count is decided from the width on the client.
   */
  index: number;
  pack: CigPack;
  amount: number | null;
  unit: PackUnit | null;
  /** The image's box inside the rule, and the rule's outer box, both in row coordinates. */
  image: { left: number; top: number; width: number; height: number };
  frame: { left: number; top: number; width: number; height: number };
  /** "3c", "5p" — or nothing, for a pack that was only bookmarked. */
  quantity: string | null;
};

export type ShelfLayout = {
  rows: ShelfRow[];
  /** Where the rows block starts, below the divider. Not zoomed. */
  rowsTop: number;
  /** One row's height and the line pitch, in design px; the stage multiplies by the zoom. */
  rowHeight: number;
  pitch: number;
  count: number;
  /** The design's clearance under the last line. */
  bottom: number;
  /** The first pack's rule width in row px — what the logo is sized to — or null with nothing on the shelf. */
  topPackWidth: number | null;
  /** The widest pack's rule on the shelf; every pack is centred in a box this wide. */
  widestPack: number;
  /** How far the boxes, panel and clouds sit right of where the design drew them. */
  dx: number;
  /** The row's width in row px, from its left edge to the clouds. */
  rowWidth: number;
  /** ...and to the panel's edge — the right edge not counting the sigils. */
  bodyWidth: number;
};

export function shelfLayout(entries: ShelfEntry[]): ShelfLayout {
  const frames = entries.map((e) => Math.round((SHELF_PACK_H * e.pack.w) / e.pack.h) + INSET * 2);
  // with nothing on the shelf, the design's own frame
  const widestPack = frames.length ? Math.max(...frames) : g.row.frame.w;
  const dx = widestPack + PACK_GAP - DESIGN_ELEMENTS_X;
  const rows = entries.map((e, i) => {
    const outerW = frames[i];
    const imgW = outerW - INSET * 2;
    // every pack centred in the widest one's box, on one axis down the column
    const left = Math.round((widestPack - outerW) / 2);
    return {
      key: e.pack.id,
      index: i,
      pack: e.pack,
      amount: e.amount,
      unit: e.unit,
      frame: { left, top: 0, width: outerW, height: g.row.frame.h },
      image: { left: left + INSET, top: INSET, width: imgW, height: SHELF_PACK_H },
      quantity: e.amount !== null && e.unit !== null ? `${e.amount}${e.unit.toLowerCase()}` : null,
    };
  });
  return {
    rows,
    rowsTop: g.row.top,
    rowHeight: g.row.height,
    pitch: g.row.pitch,
    count: rows.length,
    bottom: BOTTOM,
    topPackWidth: rows[0]?.frame.width ?? null,
    widestPack,
    dx,
    rowWidth: rowWidthFor(widestPack),
    bodyWidth: bodyWidthFor(widestPack),
  };
}

/** The block's height in design px for a given column count: lines of rows at the pitch. */
export function gridHeight(count: number, cols: number, rowHeight: number, pitch: number): number {
  if (!count) return 0;
  return (Math.ceil(count / cols) - 1) * pitch + rowHeight;
}
