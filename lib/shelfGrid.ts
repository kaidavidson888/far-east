import type { CigPack } from './cigRow';
import type { PackUnit } from './db';
import landing from './landing-geometry.json';

/**
 * THE SHELF AS A GRID (the owner's 2026-09-20 redraw).
 *
 * "redo the shelf page based on the landing page image ive attached[;] each
 * pack in the users saved should be displayed with no more than 5 a row for
 * desktop and 3 for mobile. in the outline on the bottom include the svg of
 * the clouds together but in red and make it into a button … Make sure the
 * geometry and margins are all even and as they should be[;] the image ive
 * provided are just an aproximation that may be subject to human error."
 *
 * So the one-pack-to-a-line shelf is gone, and with it the fixed-point solver
 * that sized it: that machinery existed because a row had to end on the $
 * sign, and a grid has no such constraint. What is here instead is the
 * simplest thing that is even — one margin, one gutter, equal tracks — which
 * is what the ask is really about.
 *
 * EVERY NUMBER IS MEASURED OFF THE DRAWING and then evened up, because the
 * owner says in the same breath that the drawing is approximate. What that
 * means in practice, case by case:
 *
 *   MARGIN   the drawing gives 23 on the left and 26 on the right, so 24.
 *   GUTTER   35 between the packs in both gaps of the drawing, so 35 — and
 *            the same figure is used BETWEEN ROWS, where the drawing has 79.
 *            79 is what you get from a sketch with one row of boxes drawn and
 *            the next row's left off; one gutter in both directions is what
 *            "all even" asks for.
 *   BOXES    18 tall, sitting 3 above the pack, and together exactly as wide
 *            as the pack: a wide one for the amount and a narrow one for the
 *            bookmark, 4 apart. Measured 63 + 4 + 19 = 86 against an 88 pack,
 *            56 + 4 + 17 = 77 against 79, 62 + 4 + 19 = 85 against 86 — so
 *            the narrow one is a fifth of the pair and the gap is 4.
 *   PACK     137 tall in the drawing, every pack the same height whatever its
 *            width, with a 5px half-black rule inset 2.5 into it.
 */

const LOGO = landing.parts.logo;

/** One margin on every side of the page. */
export const GRID_MARGIN = 24;
/** One gutter between the tracks, and between the rows. */
export const GRID_GUTTER = 35;

/** How many to a row. The owner's two numbers, and the width they change at. */
export const GRID_COLS = { mobile: 3, desktop: 5 } as const;
/**
 * Below this the grid is three wide. It is the width at which three of the
 * drawing's own tracks plus its margins stop fitting — 3 x 90.7 + 2 x 35 + 2 x
 * 24 = 390, the drawing's own page — rounded up to the breakpoint the rest of
 * the site uses for a phone.
 */
export const GRID_MOBILE_MAX = 640;

/**
 * THE PACK, AND WHY IT HAS A CEILING.
 *
 * A track on a 1920 screen is 338px across, and a pack drawn to fill it would
 * be 520 tall — one row of five filling the window. The drawing's pack is 137
 * tall on a 390 page, which is 35% of the width; held to that ratio a desktop
 * pack would be absurd, so the height is capped and the pack sits centred in
 * its track with the air either side. The cap is a judgement, not the owner's:
 * it is the drawing's 137 scaled by the same 1.6 the landing row's packs are
 * zoomed by on a desktop.
 */
export const PACK_H = { min: 137, max: 220 } as const;
/** The half-black rule the drawing frames each pack with, and its inset. */
export const PACK_RULE = 5;
export const PACK_RULE_INSET = 2.5;
export const PACK_RULE_ALPHA = 0.5;

/** The two boxes over each pack. */
export const CARD_BOX = {
  height: 18,
  /** between the boxes and the pack under them */
  drop: 3,
  /** between the wide box and the narrow one */
  gap: 4,
  /** the narrow one's share of the pair, measured over the drawing's three */
  markShare: 19 / 86,
  rule: 2,
} as const;

/**
 * The 遠東 logo, top left, at the size the landing page draws it — this page
 * has no reason to resize it now that the rows do not hang off its width.
 */
export const GRID_LOGO = { w: LOGO.w, h: LOGO.h } as const;

/** The header band: the logo on the left, the shelf's worth on the right. */
export const GRID_HEADER = {
  top: GRID_MARGIN,
  /** the drawing sets the price's ink about as tall as the logo's top half */
  priceH: 38,
  /** below the header, before the first row of packs */
  drop: 32,
} as const;

/**
 * THE CLOUD BUTTON AT THE FOOT OF THE PAGE.
 *
 * "in the outline on the bottom include the svg of the clouds together but in
 * red and make it into a button that on hover or click sees the clouds open up
 * within the outline into the second image."
 *
 * The outline is the page's own red rule, the full content width, and the
 * clouds open INSIDE it — so it has to be tall enough to hold the open pose
 * with air around it. The open ring is 100 units across against the shut
 * rosette's 68, so the square is sized off the OPEN pose or the clouds would
 * open straight through the rule.
 */
export const GRID_FOOT = {
  /** the square the clouds open in */
  clouds: 96,
  /** air above and below it, inside the rule */
  pad: 18,
  rule: 5,
  /** between the last row of packs and the outline */
  drop: 44,
} as const;

/** How tall the foot's outline is, rule included. */
export const footHeight = () => GRID_FOOT.clouds + 2 * GRID_FOOT.pad + 2 * GRID_FOOT.rule;

/** The two boxes over a pack, given how wide that pack is drawn. */
export function cardBoxes(packW: number) {
  const mark = Math.round(packW * CARD_BOX.markShare);
  return { amount: packW - mark - CARD_BOX.gap, mark };
}

/**
 * A track's width, given the page. Everything else on the row hangs off this.
 */
export function gridTrack(pageW: number, cols: number) {
  const content = Math.max(120, pageW - 2 * GRID_MARGIN);
  return { content, track: (content - (cols - 1) * GRID_GUTTER) / cols };
}

/** How many to a row at this width. */
export const gridCols = (pageW: number) =>
  (pageW <= GRID_MOBILE_MAX ? GRID_COLS.mobile : GRID_COLS.desktop);

/**
 * How tall a pack is drawn here: the drawing's own height, grown with the
 * track but never past the ceiling, and never wider than the track it is in.
 */
export function packHeight(track: number, aspect: number) {
  const byTrack = track / Math.max(0.2, aspect);
  return Math.round(Math.min(PACK_H.max, Math.max(PACK_H.min, byTrack)));
}

/**
 * One pack on the shelf: the pack itself, and how much of it the reader has
 * if the quantity wheels were ever used on it.
 *
 * (This lived in lib/shelfPage.ts, which held the measured geometry of the
 * one-pack-to-a-line design. That design is gone with the 2026-09-20 redraw
 * and so is the module; it is in git before this commit, along with
 * components/ShelfStage.tsx, which did the measuring it needed.)
 */
export type ShelfEntry = { pack: CigPack; amount: number | null; unit: PackUnit | null };
