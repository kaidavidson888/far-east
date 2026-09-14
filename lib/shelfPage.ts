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
 * THE ROWS SIT BETWEEN THE LOGO AND THE CAPTION BOX. The owner's rule: each
 * row's left edge is the right edge of the character logo, and its right
 * edge is the left edge of the "Click # When Finished" box, the rows keeping
 * their arrangement. So every pack's rule starts on the row's own left edge
 * (a wider pack grows to the right, into the gap before the boxes), the
 * boxes, panel and clouds keep the design's distance from it, and one zoom
 * lands the clouds on the caption box. The logo is sized to the top pack
 * about its own centre, which makes the span depend on the zoom — see
 * `shelfFit`, which solves that rather than guessing.
 *
 * THE TYPE IS THE OWNER'S FACE. Every word and number in the design was
 * outlined; the build measured its ink and this sets it in the face at the
 * size that gives the same ink height. Characters the face does not carry —
 * $ # < and the hyphens — fall through to the stack as they do everywhere.
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
  return {
    size,
    left: g.row.qty.ink.x + DX - qtyBox.left - stroke,
    top: Math.round(lineTop(inkTop, g.row.qty.asc, size)),
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
 * Advance widths in the owner's face, per 1000 em, for the two runs the
 * header has to size. The letters and digits are the ink table's; the two
 * characters the face does not carry are the fallback's, measured the same
 * way — `#` is in the table's fallback set, `$` is not and was measured in
 * Chrome at 50 per 100px alongside the rest. If the face or the fallback
 * changes, re-measure `$`.
 */
const CAPTION_EM = 12.031;
const PRICE_EM = 1.953 + 0.5;
/** The caption's tallest glyph (h, 750) — it has no descenders. */
const CAPTION_ASC = 750;
/**
 * The price is set bold. The face has one weight, drawn heavy, so "bold" is a
 * stroke laid on the glyphs — the same trick the age gate's title uses. Three
 * hundredths of the size: enough to read as weight, not enough to close the
 * counters of the 0.
 */
const PRICE_STROKE_EM = 0.03;
/** The caption clears its rule by this much on its tightest side. The owner's number. */
const CAPTION_CLEARANCE = 3;

/**
 * The header. The $240 hangs by its right edge from the aligned right margin
 * at its drawn size, bold. The caption's box takes the price's width (the
 * owner: "match the price number's width, margins maintained") — its right
 * edge and top stay where they were, its left edge comes to the price's — and
 * the caption is centred inside it and scaled up until its tightest margin to
 * the rule is CAPTION_CLEARANCE. Which side is tightest falls out of the
 * numbers: at these proportions it is the sides, with the top and bottom
 * left roomier.
 */
/**
 * Fit the caption to a box of the given width: centred, and as large as a
 * CAPTION_CLEARANCE margin to the rule allows on its tightest side. `captionEm`
 * is the run's width per em — the table's figure at first paint, and then the
 * page's own measurement, which is exact where the table is a whole-unit
 * estimate. (The measurement was first added because `#` came from the
 * fallback face, which the table could not know; `#` is in the owner's face
 * now, and the measurement stays.) Positions are relative to the inside of
 * the box's rule.
 */
export function fitCaption(boxWidth: number, captionEm: number) {
  const box = SHELF_HEADER.box;
  const innerW = boxWidth - box.stroke * 2;
  const innerH = box.height - box.stroke * 2;
  const roomW = innerW - CAPTION_CLEARANCE * 2;
  const roomH = innerH - CAPTION_CLEARANCE * 2;
  const size = +Math.min(roomW / captionEm, roomH / (CAPTION_ASC / 1000)).toFixed(2);
  const textW = captionEm * size;
  const inkH = (CAPTION_ASC / 1000) * size;
  return {
    size,
    left: +((innerW - textW) / 2).toFixed(2),
    top: +lineTop((innerH - inkH) / 2, CAPTION_ASC, size).toFixed(2),
  };
}

export const SHELF_HEADER = (() => {
  const price = g.header.price;
  const stroke = +(PRICE_STROKE_EM * price.size).toFixed(2);
  // the stroke paints half its width outside the glyph on every side
  const priceWidth = Math.round(PRICE_EM * price.size + stroke);
  const box = { top: g.header.box.y, width: priceWidth, height: g.header.box.h, stroke: g.header.box.stroke };
  return {
    box,
    caption: { text: g.header.click.text, em: CAPTION_EM, asc: CAPTION_ASC, clearance: CAPTION_CLEARANCE },
    price: {
      text: price.text,
      size: price.size,
      stroke,
      top: Math.round(lineTop(price.ink.y, price.asc, price.size)),
      /** The stroke's outer half, so the INK's right edge sits on the margin. */
      inset: +(stroke / 2).toFixed(2),
      /** The foot of the price's ink, in page px: the header's own baseline. */
      inkBottom: Math.round(price.ink.y + price.ink.h),
    },
    /** The baseline's place in a line-height:1 box, for the stage to place type by. */
    baseline: g.baseline,
  };
})();

/** The first-paint caption, from the table; the stage re-fits it in the page's own faces. */
export const CAPTION_DEFAULT = fitCaption(SHELF_HEADER.box.width, CAPTION_EM);

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
    Math.min(2 * (LOGO.y + LOGO.h / 2), 2 * (SHELF_HEADER.price.inkBottom - (LOGO.y + LOGO.h / 2))),
  ),
};

/**
 * WHERE THE ROWS GO, AND HOW BIG: the fit between the logo and the caption box.
 *
 * The owner's rule — the left edge of each row on the right edge of the
 * character logo, the right edge of each row on the left edge of the "Click #
 * When Finished" box, the rows keeping their arrangement — is one zoom and one
 * offset: z = span / gridBodyWidth — the line is a whole row, the design's own
 * gap, then a row's BODY, since the owner then asked for two to a line and
 * then for the line to end, sigils excluded, on the $ sign — and the first
 * column's x=0 placed on the logo's right.
 *
 * THE SPAN DEPENDS ON THE ZOOM. The logo is sized to the top pack, and the top
 * pack's width on screen is its row width times the zoom, so the logo's right
 * edge moves with z. It is a linear fixed point, solved rather than iterated:
 *
 *   logoRight = C + (tw · z) / 2         C the logo's centre, tw the top pack's row width
 *   z · G     = captionLeft − logoRight  G = GRID_WIDTH
 *   z         = (captionLeft − C) / (G + tw / 2)
 *
 * unless the logo's height clamp binds (SHELF_LOGO.maxHeight), when its width
 * is fixed and z = (captionLeft − C − w/2) / G. The unclamped answer is taken
 * first and the clamped one used if it is what the clamp gives.
 *
 * ON A PHONE THIS RULE HAS NO ROOM. The caption box is the price's width, hung
 * from the right margin; at 375 wide its left edge is at 123 and the logo's
 * right edge is past 85 — a span of a few dozen pixels, which would draw the
 * rows at a tenth of their size. The owner wrote the rule looking at a desktop,
 * where the span is hundreds of pixels. So where it would take the rows below
 * ROW_SCALE_FLOOR the previous phone layout holds instead: every pack's rule on
 * the left margin, the rows at FALLBACK_SHRINK of the fit to the right margin.
 * THAT SWITCH IS A JUDGEMENT, NOT THE OWNER'S — written here so it can be moved
 * or removed in one place.
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
  mode: 'between' | 'fallback';
};

export function shelfFit(
  alignedRight: number,
  priceBoxWidth: number,
  topPackWidth: number | null,
  rowWidth: number = CLOUD_RIGHT,
  bodyWidth: number = BODY_RIGHT,
): ShelfFit {
  const C = SHELF_LOGO.centreX;
  // the line's body grid: fitted to the $ sign's left edge, which is the
  // caption box's left by construction (the box takes the price's width and
  // hangs from the same right edge), so captionLeft below IS the $
  const G = gridBodyWidth(rowWidth, bodyWidth);
  const maxW = Math.round((SHELF_LOGO.maxHeight * SHELF_LOGO.w) / SHELF_LOGO.h);
  const captionLeft = alignedRight - priceBoxWidth;
  const logoAt = (w: number) => {
    const h = Math.round((w * SHELF_LOGO.h) / SHELF_LOGO.w);
    return { w, h, left: Math.round(C - w / 2), top: Math.round(SHELF_LOGO.centreY - h / 2) };
  };

  let z: number;
  let w: number;
  if (!topPackWidth) {
    // nothing on the shelf: the logo stays as drawn, and the fit is against it
    w = SHELF_LOGO.w;
    z = (captionLeft - C - w / 2) / G;
  } else {
    z = (captionLeft - C) / (G + topPackWidth / 2);
    w = Math.round(topPackWidth * z);
    if (w > maxW) {
      w = maxW;
      z = (captionLeft - C - w / 2) / G;
    }
  }
  z = +z.toFixed(4);
  if (z >= ROW_SCALE_FLOOR) {
    // the grid starts on the logo's DRAWN right edge — its rounded left plus
    // its width — not on C + w/2, which for an odd width is a half pixel and
    // would put every row's rule on one (the whole-pixel rule)
    const logo = logoAt(w);
    return { scale: z, cols: SHELF_COLUMNS, rowsLeft: logo.left + logo.w, logo, mode: 'between' };
  }

  // the phone layout: one to a line, on the margin
  const zf = +((FALLBACK_SHRINK * (alignedRight - SHELF_MARGIN)) / rowWidth).toFixed(4);
  const wf = topPackWidth ? Math.min(maxW, Math.round(topPackWidth * zf)) : SHELF_LOGO.w;
  return { scale: zf, cols: 1, rowsLeft: SHELF_MARGIN, logo: logoAt(wf), mode: 'fallback' };
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
