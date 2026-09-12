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
 * THE PACKS SIT ON ONE AXIS — the logo's centre line. Every pack's rule is
 * centred on it (the owner: "align the cigarette images on their middle
 * axis"), and the boxes, the panel and the clouds keep the design's distance
 * from that axis. The design draws exactly this: its five rules share a centre
 * at ~73, its own logo's centre. The site's logo is 8px further left, so the
 * row is moved by the difference. The logo itself is then sized to the top
 * pack's width, about its own centre, so the column reads as one thing.
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

/** The axis every pack is centred on: the logo's centre line. */
export const SHELF_AXIS_X = LOGO.x + LOGO.w / 2;
/** The design's row, moved so its packs' shared centre lands on that axis. */
const DX = Math.round(SHELF_AXIS_X - (g.row.frame.x + g.row.frame.w / 2));

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
  /** The rule round the pack, and the axis every pack is centred on. */
  rule: g.row.frame.stroke,
  axisX: SHELF_AXIS_X,
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
 * page's own measurement, because `#` comes from the fallback face and its
 * width is the fallback's, not the table's. Positions are relative to the
 * inside of the box's rule.
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
 * THE ROWS ARE SCALED TO A FIFTH SHORT OF FILLING TO THE RIGHT MARGIN.
 *
 * The clouds are the row's right edge, and the rows are scaled as one — pack,
 * boxes, panel and clouds, the same ratios. The factor that would land the
 * clouds on the aligned right is taken, and then a fifth comes off it: the
 * owner asked for "all the cigarette stuff scaled down 20%". ANCHORED ON THE
 * AXIS the packs are centred on, so a pack stays centred on the logo at any
 * zoom and the row grows out from there.
 *
 * There is no cap. The factor depends on the width, so the page measures and
 * hands it down as `--row-scale`; `rowScaleFor` is the one formula.
 *
 * IT IS `zoom`, NOT `transform: scale`. A transform scales the row's finished
 * pixels, so at 2x the type, the rules and the packs all go soft — the owner
 * saw it. `zoom` lays the row out again at the new size: type is set at the
 * size it shows at, rules are drawn at their zoomed weight, and the packs come
 * from their 3x rasters.
 */
export const ROW_SHRINK = 0.8;
export const ROW_ANCHOR_X = SHELF_AXIS_X;
export const CLOUD_RIGHT = Math.max(...SHELF_ROW.clouds.map((c) => c.left + c.width));
export const rowScaleFor = (alignedRight: number) =>
  +((ROW_SHRINK * (alignedRight - ROW_ANCHOR_X)) / (CLOUD_RIGHT - ROW_ANCHOR_X)).toFixed(4);

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
   * leave the page, and the bottom may not pass the foot of the price's ink,
   * the header's own baseline. Wherever the pack's width fits inside that —
   * every phone and tablet — the logo takes it exactly.
   */
  maxHeight: Math.floor(
    Math.min(2 * (LOGO.y + LOGO.h / 2), 2 * (SHELF_HEADER.price.inkBottom - (LOGO.y + LOGO.h / 2))),
  ),
};

/** The design's own width sets the first-paint values, before the page measures. */
const DESIGN_ALIGNED_RIGHT = g.viewBox.w - SHELF_MARGIN;
export const SHELF_DEFAULTS = {
  alignedRight: DESIGN_ALIGNED_RIGHT,
  rowScale: rowScaleFor(DESIGN_ALIGNED_RIGHT),
};

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
export const SHELF_QUANTITY_FRAME = (() => {
  const plus = SHELF_ROW.plusBox;
  const panel = SHELF_ROW.panel;
  const menu = {
    left: plus.left,
    top: plus.top,
    width: panel.left + panel.width - plus.left,
    height: panel.top + panel.height - plus.top,
  };
  const stroke = plus.stroke;
  const pitch = Math.floor((menu.height - stroke * 2) / 3);
  return {
    plus: { left: plus.left, top: plus.top, width: plus.width, height: plus.height },
    menu,
    stroke,
    pitch,
    fontSize: Math.round(pitch * 0.78),
  };
})();

export type ShelfRow = {
  key: string;
  /** From the top of the rows block, in design px — the block is what zooms. */
  top: number;
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
  /** The block's own height in design px; the page multiplies by the zoom. */
  rowsHeight: number;
  /** The design's clearance under the last row. */
  bottom: number;
  /** The first pack's rule width in row px — what the logo is sized to — or null with nothing on the shelf. */
  topPackWidth: number | null;
};

export function shelfLayout(entries: ShelfEntry[]): ShelfLayout {
  const rows = entries.map((e, i) => {
    const imgW = Math.round((SHELF_PACK_H * e.pack.w) / e.pack.h);
    const outerW = imgW + INSET * 2;
    // every pack centred on the axis; a wider pack grows both ways
    const left = Math.round(SHELF_AXIS_X - outerW / 2);
    return {
      key: e.pack.id,
      top: i * g.row.pitch,
      pack: e.pack,
      amount: e.amount,
      unit: e.unit,
      frame: { left, top: 0, width: outerW, height: g.row.frame.h },
      image: { left: left + INSET, top: INSET, width: imgW, height: SHELF_PACK_H },
      quantity: e.amount !== null && e.unit !== null ? `${e.amount}${e.unit.toLowerCase()}` : null,
    };
  });
  const rowsHeight = rows.length ? (rows.length - 1) * g.row.pitch + g.row.height : 0;
  return { rows, rowsTop: g.row.top, rowsHeight, bottom: BOTTOM, topPackWidth: rows[0]?.frame.width ?? null };
}
