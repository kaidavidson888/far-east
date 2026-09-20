import type { CigPack } from './cigRow';
import type { PackUnit } from './db';
import landing from './landing-geometry.json';

/**
 * THE SHELF AS A GRID (the owner's 2026-09-20 redraw).
 *
 * "redo the shelf page based on the landing page image ive attached[;] each
 * pack in the users saved should be displayed with no more than 5 a row for
 * desktop and 3 for mobile … Make sure the geometry and margins are all even
 * and as they should be[;] the image ive provided are just an aproximation
 * that may be subject to human error."
 *
 * So the one-pack-to-a-line shelf is gone, and with it the fixed-point solver
 * that sized it: that machinery existed because a row had to end on the $
 * sign, and a grid has no such constraint. What is here instead is the
 * simplest thing that is even — one margin, one gutter, equal tracks.
 *
 * THE CARD IS MODELLED ON THE FIRST PACK OF THE DRAWING, which is the only
 * one drawn with its whole interface (the owner: "look at the first cigarette
 * pack with the full UI and use that as a model for all the others"). Read off
 * the file, that card is:
 *
 *      [ 12x            63x18 ] [ bookmark  19x18 ]     <- outlined, red
 *      [ the pack            88 x 137, rule on its edge ]
 *      [ clouds 19x18 ] [ leave a comment <3     64x20 ] <- outline, then solid
 *
 * The narrow box swaps sides between the two rows — bookmark top RIGHT, clouds
 * bottom LEFT — and each row spans exactly the pack's width (35..122 against
 * an image at 34..122). Everything below is that card, in proportions of the
 * pack so it holds at any size.
 *
 * EVERY NUMBER IS MEASURED OFF THE DRAWING and then evened up, because the
 * owner says in the same breath that the drawing is approximate:
 *
 *   MARGIN   23 on the left and 26 on the right, so 24.
 *   GUTTER   35 between the packs in both gaps, so 35 — and the same figure
 *            between the rows, where the drawing has 79. One gutter in both
 *            directions is what "all even" asks for.
 *   BOXES    18 tall over the pack and 18/20 under it, so 18 for all four.
 *            The pair is 4 apart and together exactly the pack's width.
 *   PACK     137 tall, every pack the same height whatever its width.
 */

const LOGO = landing.parts.logo;

/** One margin on every side of the page. */
export const GRID_MARGIN = 24;
/** One gutter between the tracks, and between the rows. */
export const GRID_GUTTER = 35;

/** How many to a row. The owner's two numbers, and the width they change at. */
export const GRID_COLS = { mobile: 3, desktop: 5 } as const;
/**
 * Below this the grid is three wide: 3 x 90.7 + 2 x 35 + 2 x 24 = 390, the
 * drawing's own page, rounded up to the breakpoint the rest of the site uses.
 */
export const GRID_MOBILE_MAX = 640;

/**
 * THE PACK, AND WHY IT HAS A CEILING.
 *
 * A track on a 1920 screen is 346px across, and a pack drawn to fill it would
 * be 530 tall — one row of five filling the window. The drawing's pack is 137
 * tall on a 390 page; the height is capped and the pack sits centred in its
 * track with the air either side. The cap is a judgement, not the owner's.
 */
export const PACK_H = { min: 137, max: 220 } as const;

/**
 * EVERYTHING ON A CARD IS A FRACTION OF THE PACK'S HEIGHT, so the card holds
 * its proportions from a phone to a desktop rather than carrying one set of
 * numbers that only look right at 390px. Each is the drawing's own measurement
 * over the drawing's own 137.
 */
export const CARD = {
  /** 18 of 137: the height of all four boxes */
  boxH: 18 / 137,
  /** 3 of 137: between the pack and the row above or below it */
  drop: 3 / 137,
  /** 4 of 18: between the two boxes in a row */
  gap: 4 / 18,
  /** 19 of 86: the narrow box's share of the pair */
  markShare: 19 / 86,
  /** the red rule round the boxes */
  rule: 2,
  /** the type in the amount box, and in the comment bar */
  amountEm: 0.62,
  commentEm: 0.36,
} as const;

/**
 * THE HALF-BLACK RULE GOES ON THE PACK'S EDGE, NOT OVER IT (the owner's "make
 * sure the low opacity black outline is on the edge of the image not over
 * it").
 *
 * The drawing has it over: measured across the first pack's left edge, the
 * image starts at x=34 and reads 76,8,25 through to x=38, with the artwork's
 * own 152,12,49 only from x=39 — so the rule darkens the outermost five pixels
 * of the picture. Here it is drawn entirely OUTSIDE the image with its inner
 * edge on the image's, which is the only arrangement where nothing at all is
 * over the artwork. It is an absolutely placed ring rather than a border, so
 * it costs the card no width and the pack keeps its own.
 */
export const PACK_RULE = 5;
export const PACK_RULE_ALPHA = 0.5;

/** The 遠東 logo, top left, at the size the landing page draws it. */
export const GRID_LOGO = { w: LOGO.w, h: LOGO.h } as const;

/** The header band: the logo on the left, the shelf's worth on the right. */
export const GRID_HEADER = {
  top: GRID_MARGIN,
  /** the drawing sets the price's ink about as tall as the logo's top half */
  priceH: 38,
  /** below the divider, before the first row of packs */
  drop: 32,
} as const;

/**
 * The words in the drawing's own comment bar. It is drawn and does nothing:
 * `pack_favorites` has nowhere to keep a note, and inventing that is a
 * migration rather than a page — the old shelf's panel was the same.
 */
export const CARD_COMMENT = 'Leave a comment <3';

/**
 * One pack on the shelf: the pack itself, and how much of it the reader has
 * if the quantity wheels were ever used on it.
 *
 * (This lived in lib/shelfPage.ts, which held the measured geometry of the
 * one-pack-to-a-line design. That design went with the redraw and so did the
 * module; it is in git, along with components/ShelfStage.tsx.)
 */
export type ShelfEntry = { pack: CigPack; amount: number | null; unit: PackUnit | null };
