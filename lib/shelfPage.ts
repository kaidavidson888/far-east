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

/** The design's row, moved so its pack centres on the logo the page draws. */
const DX = Math.round(LOGO.x + LOGO.w / 2 - (g.row.frame.x + g.row.frame.w / 2));

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
  /** The rule round the pack: its weight, and the centre line every pack shares. */
  rule: g.row.frame.stroke,
  centreX: LOGO.x + LOGO.w / 2,
};

export const SHELF_HEADER = {
  box: {
    right: g.viewBox.w - (g.header.box.x + g.header.box.w),
    top: g.header.box.y,
    width: g.header.box.w,
    height: g.header.box.h,
    stroke: g.header.box.stroke,
  },
  click: { text: g.header.click.text, size: g.header.click.size },
  price: {
    text: g.header.price.text,
    size: g.header.price.size,
    right: g.viewBox.w - (g.header.box.x + g.header.box.w),
    top: lineTop(g.header.price.ink.y, g.header.price.asc, g.header.price.size),
  },
};

/** The design's own clearance under its last row, held under ours. */
const BOTTOM = g.viewBox.h - (g.row.top + (g.row.count - 1) * g.row.pitch + g.row.height);

export type ShelfRow = {
  key: string;
  top: number;
  pack: CigPack;
  /** The image's box inside the rule, and the rule's outer box, both in row coordinates. */
  image: { left: number; top: number; width: number; height: number };
  frame: { left: number; top: number; width: number; height: number };
  /** "3c", "5p" — or nothing, for a pack that was only bookmarked. */
  quantity: string | null;
};

export function shelfLayout(entries: ShelfEntry[]): { rows: ShelfRow[]; minHeight: number } {
  const rows = entries.map((e, i) => {
    const imgW = Math.round((SHELF_PACK_H * e.pack.w) / e.pack.h);
    const outerW = imgW + INSET * 2;
    const left = Math.round(SHELF_ROW.centreX - outerW / 2);
    return {
      key: e.pack.id,
      top: g.row.top + i * g.row.pitch,
      pack: e.pack,
      frame: { left, top: 0, width: outerW, height: g.row.frame.h },
      image: { left: left + INSET, top: INSET, width: imgW, height: SHELF_PACK_H },
      quantity: e.amount !== null && e.unit !== null ? `${e.amount}${e.unit.toLowerCase()}` : null,
    };
  });
  const last = rows.length ? rows[rows.length - 1].top + g.row.height : g.row.top;
  return { rows, minHeight: last + BOTTOM };
}
