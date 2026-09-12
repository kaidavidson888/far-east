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
 * logo sits at the landing page's own margins; the header keeps the design's
 * distance from the right edge; the rows keep the design's distance from the
 * top and from each other, and grow down the page as the shelf does.
 *
 * THE PACKS ARE CENTRED ON THE LOGO. In the design the five rules round the
 * packs share one centre line, and it is the centre of the logo — the owner
 * asked for exactly that. The design draws its logo 8px right of where the
 * site's logo sits (the raster's ink starts at 54, the landing vector at
 * 45), so the whole row is moved left by the difference: every box, the
 * panel and the clouds keep their distance from the pack, and the pack keeps
 * its centre on the logo the page actually draws.
 *
 * THE TYPE IS THE OWNER'S FACE. Every word and number in the design was
 * outlined; the build measured its ink and this sets it in the face at the
 * size that gives the same ink height. Characters the face does not carry —
 * $ # < and the hyphens — fall through to the stack as they do everywhere.
 * The price is right-aligned rather than left, because the face is a third
 * wider than the design's and a left-aligned $240 at this size would run
 * into the logo; its right edge is the header box's, which is what the
 * design lines it up with.
 */
export type ShelfEntry = { pack: CigPack; amount: number | null; unit: PackUnit | null };

const g = geometry;
const LOGO = landing.parts.logo;

/**
 * THE MARGINS ARE SYMMETRIC, AND THE ROW'S LEFT EDGE IS THE LEFT MARGIN. The
 * owner's rule: the aligned left edge of every row holds the same margin from
 * the page's left as the aligned right edge holds from its right, and that
 * margin is the logo's own (its left edge, 45). The design draws its packs'
 * rules starting at 42-47, on its own logo's left — the same relation — so the
 * row is moved by the difference and every pack's rule starts on the margin.
 * (An earlier version centred the packs on the logo's centre line, which the
 * design also happens to satisfy at 1x, but which pushed the packs off the
 * page's left edge once the rows were scaled up. The owner's instruction is
 * the left edge, so that is what holds.)
 */
export const SHELF_MARGIN = LOGO.x;
const DX = SHELF_MARGIN - g.row.frame.x;

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
const lineTop = (inkTop: number, asc: number, size: number) => Math.round(inkTop - (g.baseline - asc / 1000) * size);

type Run = { text: string; size: number; asc: number; ink: Box };
const typeAt = (run: Run, x: number) => ({
  size: run.size,
  left: x,
  top: lineTop(run.ink.y, run.asc, run.size) - g.row.top,
});

/*
 * The aligned right edge is `width - SHELF_MARGIN`, measured live by the
 * stage (not a fixed design x): the logo is left-anchored in real pixels, so
 * the right has to be too for the two margins to match at every width.
 */

/** The row's fixed furniture, in row coordinates. Computed once. */
export const SHELF_ROW = {
  height: g.row.height,
  pitch: g.row.pitch,
  plusBox: { ...rel(g.row.plusBox), stroke: g.row.plusBox.stroke },
  plusH: rel(g.row.plusH),
  plusV: rel(g.row.plusV),
  bookmarkBox: { ...rel(g.row.bookmarkBox), stroke: g.row.bookmarkBox.stroke },
  bookmark: rel(g.row.bookmark),
  qtyBox: { ...rel(g.row.qtyBox), stroke: g.row.qtyBox.stroke },
  /** The quantity, set where the design's "12x" starts. */
  qty: typeAt(g.row.qty, g.row.qty.ink.x + DX),
  panel: rel(g.row.panel),
  line1: { ...typeAt(g.row.line1, g.row.line1.ink.x + DX), text: g.row.line1.text },
  line2: { ...typeAt(g.row.line2, g.row.line2.ink.x + DX), text: g.row.line2.text },
  clouds: g.row.clouds.map(rel),
  /** The rule round the pack: its weight, and the left edge every pack's rule starts on. */
  rule: g.row.frame.stroke,
  left: SHELF_MARGIN,
};

/**
 * The header — the "Click # When Finished" box and the $240 — MOVES to the
 * right margin but does not scale (the owner: "move the price and the box
 * above it, keep the same ratios"). Both are hung from the aligned right edge,
 * which the page supplies live as `--aligned-right`, so their right edge sits
 * the logo's-margin in from the page's right at every width. The box keeps its
 * drawn width; the $240 keeps its drawn size.
 */
export const SHELF_HEADER = {
  box: {
    top: g.header.box.y,
    width: g.header.box.w,
    height: g.header.box.h,
    stroke: g.header.box.stroke,
  },
  click: { text: g.header.click.text, size: g.header.click.size },
  price: {
    text: g.header.price.text,
    size: g.header.price.size,
    top: lineTop(g.header.price.ink.y, g.header.price.asc, g.header.price.size),
  },
};

/** The design's own clearance under its last row, held under ours. */
const BOTTOM = g.viewBox.h - (g.row.top + (g.row.count - 1) * g.row.pitch + g.row.height);

/**
 * THE ROWS SCALE UP TO FILL FROM THEIR LEFT TO THE RIGHT MARGIN, AT ANY WIDTH.
 *
 * The clouds are the row's right edge, and the rows are scaled as one — pack,
 * boxes, panel and clouds, the same ratios — so that edge lands on the aligned
 * right. ANCHORED ON THE LEFT MARGIN, where every pack's rule starts: that is
 * the point that must not move, so the row grows rightward from it and the
 * left margin holds at any zoom.
 *
 * There is no cap. The owner's rule is that the right margin mirrors the left
 * at whatever width the page is, and on a wide screen that means big rows;
 * that is the instruction, and it is what the page does.
 *
 * IT IS `zoom`, NOT `transform: scale`. A transform scales the row's finished
 * pixels, so at 2x the type, the rules and the packs all go soft — the owner
 * saw it. `zoom` lays the row out again at the new size: type is set at the
 * size it shows at, rules are drawn at their zoomed weight, and the packs come
 * from their 3x rasters. The factor depends on the width, so the page measures
 * and hands it down as `--row-scale`; `rowScaleFor` is the one formula.
 */
export const ROW_ANCHOR_X = SHELF_MARGIN;
export const CLOUD_RIGHT = Math.max(...SHELF_ROW.clouds.map((c) => c.left + c.width));
export const rowScaleFor = (alignedRight: number) =>
  +((alignedRight - ROW_ANCHOR_X) / (CLOUD_RIGHT - ROW_ANCHOR_X)).toFixed(4);

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
};

export function shelfLayout(entries: ShelfEntry[]): ShelfLayout {
  const rows = entries.map((e, i) => {
    const imgW = Math.round((SHELF_PACK_H * e.pack.w) / e.pack.h);
    const outerW = imgW + INSET * 2;
    // every rule starts on the margin; a wider pack grows to the right
    const left = SHELF_ROW.left;
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
  return { rows, rowsTop: g.row.top, rowsHeight, bottom: BOTTOM };
}
