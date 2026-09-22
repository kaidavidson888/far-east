import type { CigPack } from './cigRow';
import type { PackUnit } from './db';
import shelfmenu from './shelfmenu-geometry.json';
import { SPLASH_GEOM, splashAsset } from './splashFrames';
import INK from '@/scripts/assets/far-east-ink.json';

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
 *
 * (That card is gone; the shelf is a wheel. What is kept below is what
 * outlived it — the page's margin, the pack's rule, the caret's sprite
 * window and the amount's arithmetic.)
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

/** One margin on every side of the page. */
export const GRID_MARGIN = 24;
/** One gutter between the tracks, and between the rows. */
export const GRID_GUTTER = 35;

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
  /** the type in the amount box, as a fraction of the box's height */
  amountEm: 0.62,
  /**
   * The number in the selector, sized to hold its widest value ("90") inside
   * the square. The shelf's worth is a tenth larger than this — the owner's
   * rule, so it is stated once and read twice.
   */
  countEm: 0.55,
  /**
   * The comment bar's side margin — what the L of the phrase already stood
   * off the rectangle, and now also what the caret stands off it and what
   * separates the caret from the typed run. The phrase is sized to fit
   * between two of them; see CARD_COMMENT_EM.
   */
  commentPad: 0.22,
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
 *
 * IT IS 5, AND IT IS ITS OWN NUMBER AGAIN (the owner's 2026-09-21 "make the
 * black outlines around the cig images 5px"). It was 5 to begin with, went
 * to `CARD.rule` for an afternoon when the ask was "the same thickness as
 * the outlines above the image" — the four red boxes that stood over a card
 * — and those boxes are gone with the grid. So the pack's rule answers to
 * nothing but itself now, and the controls' 2px rule answers to nothing but
 * itself either.
 *
 * EVERYTHING ELSE FOLLOWS ON ITS OWN, because nothing carries the figure
 * separately: the ring, the step from one pack to the next, the margins the
 * controls keep off the outline and the width the quantity menu opens to are
 * all written in terms of this, and the menu measures the outline live.
 *
 * IT IS WHITE, NOT HALF-BLACK (the owner's "make them white"). Half strength
 * was part of being black — the drawing's "low opacity black outline" — so
 * it went with the colour: white at 50% over red is pink.
 */
export const PACK_RULE = 5;

/**
 * THE MOUNTAIN BUTTON'S SCALE ON THIS PAGE (the owner's 2026-09-21: the
 * landing page's button, "with the same scale and margins in relation to the
 * page border").
 *
 * On the landing page the number is published by `CigScroller`: the tag
 * menu's own zoom, which is the framed pack's width over the menu's design
 * width, floored at 0.7. There is no cigarette row here, so it has to be
 * stated — and 0.7 is not an approximation of the landing page's value, it
 * IS the landing page's value at every viewport narrower than about 1845px,
 * because the floor binds everywhere below that. Above it the landing
 * button grows, and it also changes there whenever the row settles on a pack
 * of a different width, so "the same scale" has no single number to copy;
 * the floor is the one the two pages actually share.
 *
 * IT IS CLAMPED DOWN ON A NARROW WINDOW, and that is the fourth word's
 * doing. Three words reach 363px at 0.7 and fit a 390px phone; four reach
 * 437 and do not. Below that the menu takes what room there is, which is the
 * same bargain `MENU_MIN_ZOOM` strikes for the tag menu. `MENU_VIEW_W` is
 * the canvas the bake wrote — read from the geometry, so it follows a
 * rebuild rather than being typed again.
 */
export const MENU_VIEW_W = shelfmenu.frame.w;
/** The button's own margin off the page's border, which the bake wrote. */
export const MENU_MARGIN = shelfmenu.place.left;
/** The landing page's floor, and so the scale the two pages share. */
export const MENU_ZOOM_MAX = 0.7;
/**
 * The zoom that fits the whole row between the two margins.
 *
 * IT HAS TO BE MEASURED RATHER THAN WRITTEN IN CSS. A zoom is a unitless
 * number and CSS cannot divide one length by another, so `min(0.7, (100vw -
 * 20px) / 610)` is not a thing that can be written — that expression divides
 * a length by a number and yields a length, which `min()` will not mix with
 * 0.7. The landing page measures its own for the same reason.
 */
export function shelfMenuZoom(clientWidth: number): number {
  const room = clientWidth - MENU_MARGIN * 2;
  return Math.min(MENU_ZOOM_MAX, +(room / MENU_VIEW_W).toFixed(4));
}

/**
 * WHAT THE SHELF IS WORTH, and where the money comes from.
 *
 * This number was drawn from the first day and had NOTHING BEHIND IT for
 * three redraws: `pack_favorites` keys on a pack id and `lib/cigs.json`
 * carries no money, so the shelf could not be totalled and the route passed
 * no `worth` at all.
 *
 * IT CAN BE TOTALLED FROM `cigtags.json`. That file is generated from the
 * owner's own 235 cigarette pages and carries a PRICE PER PACK for every one
 * of the 247 — the "$15 / $25 / $30" the tag menu filters by, read off the
 * pages themselves rather than invented here. Multiply it by how many packs
 * the reader says they have (`cardAmount`, which is the wheels' answer with
 * a carton counted as ten) and sum.
 *
 * A PACK WITH NO AMOUNT SET IS WORTH NOTHING, which is the same answer its
 * own number square gives: the shelf holds it, and the reader has not said
 * they have any. So a shelf nobody has counted reads $0 — that is the data
 * being honest, not the sum being broken.
 *
 * The caller supplies the price, so the 247-pack tag table stays on the
 * server and never reaches this page's bundle.
 */
export function shelfWorth(entries: ShelfEntry[], priceOf: (id: string) => number): string {
  let total = 0;
  for (const e of entries) {
    const packs = cardAmount(e.amount, e.unit);
    if (packs) total += packs * priceOf(e.pack.id);
  }
  return `$${total.toLocaleString('en-US')}`;
}

/** The words in the drawing's own comment bar, which is now a button. */
export const CARD_COMMENT = 'Leave a comment <3';

/**
 * HOW WIDE THAT PHRASE IS, IN EMS OF THE FACE THE BAR SETS IT IN — 11.916,
 * measured on the live bar in Chrome with the element's own computed font, at
 * 100, 400 and 1000px, identical to five places at all three.
 *
 * It is here because the bar has to SET THE PHRASE TO FIT (the owner's
 * 2026-09-21 "Scale the leave a comment text down so its fully visible while
 * having the margin it currently has between its left edge and the edge of
 * the rectangle behind it on both sides"), and a fraction of the box's height
 * cannot do that — the previous 0.36 gave 10.4px where the bar had room for
 * 7.3, and the phrase read "Leave a comme".
 *
 * THE DRAWING CANNOT BE FOLLOWED HERE AND THAT IS WORTH KNOWING. Its bar is
 * 64 x 20 with the phrase filling 46% of it, set in the mockup's own narrow
 * sans at about 3.5px. This face is a third wider than any fallback (0.67em
 * mean lowercase advance), so the same 18 characters want 11.9 ems: at this
 * bar's width the phrase lands near 7px, under the 9 this site knows a line
 * needs to render solid. Fully visible is what was asked for, so fully
 * visible is what it gets, and the phrase only shows under the pointer.
 *
 * A HAIR OF SLACK (12.05 against 11.916, 1.1%) because one character of the
 * eighteen is not in the owner's face: `<` comes from "Exo 2", the next in the
 * stack. That is a webfont the site loads, so the figure is the same on every
 * platform — but if Google Fonts ever fails to load, the `<` falls through to
 * whatever the system has, and the slack is what keeps the phrase inside its
 * bar when it does.
 */
export const CARD_COMMENT_EM = 12.05;

/**
 * THE VERTICAL DASHED CARET IN THE COMMENT BAR (the owner's 2026-09-21 "by
 * default have a vertical dashed line like in the login bar that is the same
 * height as the cloud star").
 *
 * It is the login box's own mark — one window onto `blackbox.webp`, the
 * hand-drawn sprite, which is the same rule the splash's rows open with. Two
 * things make it simpler here than there:
 *
 *   IT IS EXACTLY ONE TILE, SCALED. The login row needs 5.66 tiles for its
 *   58px span and so uses six squeezed 5.6%; this caret is one drawn tile's
 *   worth of line, so it is scaled uniformly and the dashes keep the
 *   proportion they were drawn with — no squeeze, no stretch. That is what
 *   fixes the width: the mark is 0.0140 of the sprite wide and 0.072 tall, so
 *   a caret of height H is H x 0.19444 across, and its three dashes read.
 *
 *   IT IS A MASK, NOT AN IMAGE. The sprite is baked with RGB zeroed and every
 *   thing in alpha, so a masked block of colour reproduces it pixel for pixel
 *   in any colour — which is what lets the same mark be black at rest and
 *   white under the pointer, one property changing. The login row's own ☁ and
 *   the search bar's are built this way; this is the first time the dashed
 *   rule is.
 */
const RULE = SPLASH_GEOM.parts.email;
export const CARD_CARET = {
  /** the sprite window: the email row's rule, x 43..49 and y 63..94 of 430 */
  x0: RULE.x0,
  y0: RULE.y0,
  w: RULE.ruleX1 - RULE.x0,
  h: RULE.dY0 - RULE.y0,
  /** a caret H tall is this much across, which is the mark's drawn shape */
  aspect: (RULE.ruleX1 - RULE.x0) / (RULE.dY0 - RULE.y0),
  /**
   * THE LINE UNDER IT, from the same drawing (the owner's 2026-09-21 "add a
   * bottom dashed line that has the same margins on its left and right side
   * with the outline box as the vertical one"). It is the login row's own
   * horizontal dash band — the line the typed letters sit on — so the two
   * marks in this little box are the two marks that make a row of the login
   * box, at the same scale and from the same hand.
   */
  hx0: RULE.textX0,
  hy0: RULE.dY0,
  hh: RULE.dY1 - RULE.dY0,
  /** how much of the band's length there is to draw from */
  hw: RULE.dashX1 - RULE.textX0,
  /** the sprite, versioned — a rebuild rewrites the file in place */
  src: splashAsset('blackbox.webp'),
  /**
   * HOW TALL: the cloud star's own height. The shut rosette spans 50.86 of
   * the 100-unit view (measured off the rendered button with getBBox), and
   * the view is drawn into the clouds box less its rule — so the caret is
   * that share of the same inner height and the two marks stand equal.
   */
  ofStar: 0.5086,
  /**
   * THE FACE'S WHOLE BAND, tallest ascender over deepest descender, taken
   * from the ink table rather than named: b rises 828 and y drops 234, so
   * 1.062 em. The typed run is set so that this band is the caret's height,
   * which is "make the typed text the same height as the line".
   *
   * IT IS NOT THE LOGIN ROW'S 0.859. That is I over P — an all-caps band,
   * right there because the login box sets everything in capitals, and two
   * fifths too short here where a reader can type a b or a y. Sized by the
   * band rather than by the word, the line does not jump between a comment
   * with a descender and one without.
   */
  band: (Math.max(...Object.values(INK.asc)) + Math.max(...Object.values(INK.desc))) / INK.em,
} as const;

/**
 * HOW LONG A COMMENT MAY BE — `saveNoteAction`'s own 400, which is the cap
 * the catalogue shelf's note has carried since the beginning and so is the
 * cap "the existing comment system" means.
 *
 * IT LIVES HERE RATHER THAN IN `app/actions.ts` because that module is
 * `'use server'`, and such a module may export only async functions: a plain
 * `const` there silently strips EVERY export from the file and the first
 * sign is a runtime error saying an action that is obviously there does not
 * exist. `lib/authPolicy.ts` exists for the same reason. The editor reads it
 * for `maxLength` and the action slices to it.
 */
export const NOTE_MAX = 400;

/**
 * THE TEXT EDITOR, ONCE IT IS OPENED (the owner's 2026-09-22). Every figure
 * is one the owner named, and the two that are not — where the rectangle
 * stands and how thick its rule is — are noted as the judgements they are.
 */
export const EDITOR = {
  /**
   * TEN PIXELS, and the owner said it four times: the vertical dashed rule
   * stands this far inside the rectangle on the left, the top and the foot;
   * the typed run begins this far right of the rule; and the ☁ waits this
   * far past the prompt. It is a REAL CSS PIXEL like the mountain button's
   * 10px margins, not a fraction of anything, so it does not shrink with
   * the page.
   */
  pad: 10,
  /**
   * THE RECTANGLE'S RULE IS THE CONTROLS' 2px, not the pack's 5. What the
   * owner borrowed from the pack's outline was its OPACITY ("a rectangle
   * that is white with the same opacity as the outline of the cig images"),
   * and every box on this page is drawn at the controls' weight.
   */
  rule: CARD.rule,
  /** and that borrowed opacity: what the pack's rule wears at rest */
  ink: 'rgb(255 255 255 / 0.5)',
  /**
   * THE RECTANGLE IS FILLED WITH THE PAGE'S OWN BLACK, which draws nothing
   * that is not already there and does one necessary job: the favourite
   * button stands on this line, and an editor with a transparent middle
   * would have a bookmark showing through it. "Black fill" is this page's
   * own word for it.
   */
  fill: '#000000',
  /**
   * WHERE A `line-height: 1` BOX PUTS ITS BASELINE, measured in Chrome —
   * 0.825 of the size, the figure the login row and the shelf place all
   * their type by. It is how a line of type is hung from an ink line rather
   * than from a box that happens to be near it.
   */
  baseline: 0.825,
  /**
   * SO THE LIFT IS ALMOST NOTHING, and it is worth having written down. To
   * put a run's ink TOP on the rule's top, the box goes at
   * `rule.top - baseline * size + maxAscent * size` — and this face's
   * tallest ascender (b, 828) lands within three thousandths of where a
   * `line-height: 1` box already puts its baseline. So the correction is
   * 0.003 of the type size: real, stated, and under a hundredth of a pixel
   * at the size this editor sets.
   */
  lift: Math.max(...Object.values(INK.asc)) / INK.em - 0.825,
} as const;

/**
 * THE FIVE SIGILS THAT OPEN BESIDE THE CLOUD STAR (the owner's 2026-09-22:
 * "I want 5 sigils to appear all scaled to the same height as the total price
 * number space them evenly including an even space before the first one and
 * after the last one. Make them fit between the newly moved cloud star button
 * and the right edge of the cig image outline").
 *
 * THE EVEN SPACING IS `space-evenly`, NOT ARITHMETIC. Five marks with six
 * equal gaps, the first and the last included, is exactly what that keyword
 * lays out — so the row is given the span to fill (the star's right edge to
 * the pack outline's) and the browser divides it. Nothing here has to know
 * how wide a pack came out, which is the thing that changes with every pack
 * on the wheel.
 */
export const RATE = {
  /** five, the owner's count */
  count: 5,
  /** the ☁ as drawn — public/sigil.webp is 126 x 60 */
  aspect: 126 / 60,
  /**
   * AS TALL AS THE TOTAL PRICE NUMBER, which is a band and not one value.
   * Taken off the ink table as the tallest ascent and the deepest descent of
   * the TEN DIGITS (703 and 31, so 0.734 em) rather than of whatever the
   * total happens to read today — sized to the digits it contains, a mark
   * would stand a pixel taller on a shelf worth $1,200 than on one worth
   * $1,100, which is not a rule anybody could see the sense of.
   *
   * IT IS THE DIGITS AND NOT THE `$`. That glyph rises to 781 and drops to
   * 94, half again as tall, and the owner named the NUMBER.
   */
  em: ([...'0123456789'] as (keyof typeof INK.asc)[]).reduce(
    (m, d) => Math.max(m, INK.asc[d]), 0,
  ) / INK.em
    + ([...'0123456789'] as (keyof typeof INK.desc)[]).reduce(
      (m, d) => Math.max(m, INK.desc[d]), 0,
    ) / INK.em,
} as const;

/**
 * WHAT THE AMOUNT BOX SAYS (the owner's 2026-09-21: "take the number tagged
 * with the pack and multiply by 1 if P was selected and 10 if C was selected
 * … dont display the letter just multiply").
 *
 * A carton is ten packs, so this is the count in packs. `amount` is held to
 * 1..9 and `unit` to C or P by the database's own CHECK, and the two are
 * nullable only together — so the answer is one of 1..9, or 10..90 by tens,
 * or nothing at all for a pack that was bookmarked and never counted.
 *
 * THE DISPLAY IS ONLY LOSSLESS WHILE `amount` STOPS AT 9. Ten packs would
 * read as 10 and so would one carton; the wheels offer 1-9, so the collision
 * cannot happen today. Widen that range and this becomes lossy. The unit is
 * still named in the accessible label, where there is room for it.
 */
export function cardAmount(amount: number | null, unit: PackUnit | null): number | null {
  if (!amount || !unit) return null;
  return amount * (unit === 'C' ? 10 : 1);
}

/**
 * THE WHEELS, OPENING OUT OF THE AMOUNT BOX (the owner's 2026-09-21: "If the
 * user hovers over the outline have the same + button selector menu appear
 * coming from the top left corner of the outline and going down and to the
 * right. Make it 50% opacity and the same width as the outline around the cig
 * image").
 *
 * That is `CigQuantity` unchanged — hover at 50%, press for solid, and a
 * `clip-path` that opens from the element's own top-left rightward and
 * downward. All this has to supply is the frame, and the frame's origin is
 * (0, 0) because the amount box's own corner is the offset parent's corner
 * and, since the rows now span the outline, that corner IS the outline's.
 *
 * THE MENU'S HEIGHT IS NOT THE BOX'S, and that is the one judgement here. The
 * box is 18/137 of the pack — 18px on a phone — and three wheel slots inside
 * it would be a 4px pitch and 3px type, far under the 9px this site knows a
 * line needs. So the SLOT is sized first, off the pack, with a floor; the
 * menu is three of them and its rule. The box gives the menu its corner and
 * the pack outline gives it its width; neither gives it its height.
 */
export function cardQuantityFrame(
  outlineW: number,
  box: { w: number; h: number },
  packH: number,
) {
  const stroke = CARD.rule;
  /** one wheel slot: a ninth of the pack, never under 14 */
  const pitch = Math.max(14, Math.round(packH * 0.11));
  return {
    // the trigger lies exactly over the amount box, so the box is the button
    plus: { left: 0, top: 0, width: box.w, height: box.h },
    menu: { left: 0, top: 0, width: outlineW, height: pitch * 3 + stroke * 2 },
    stroke,
    pitch,
    // the ratio the old shelf's wheels used, kept so the two read alike
    fontSize: Math.round(pitch * 0.78),
  };
}

/**
 * One pack on the shelf: the pack itself, and how much of it the reader has
 * if the quantity wheels were ever used on it.
 *
 * (This lived in lib/shelfPage.ts, which held the measured geometry of the
 * one-pack-to-a-line design. That design went with the redraw and so did the
 * module; it is in git, along with components/ShelfStage.tsx.)
 */
export type ShelfEntry = {
  pack: CigPack;
  amount: number | null;
  unit: PackUnit | null;
  /** 1-5 sigils, or null for a pack the reader has not rated */
  rating: number | null;
  /** what the reader wrote about it, '' for nothing */
  note: string;
};
