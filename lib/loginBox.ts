/**
 * THE LOGIN BOX IS ONE LONG ROW NOW, not a square with three in it.
 *
 * The owner's 2026-09-20 ask: "instead of a box with 3 rows I want to change
 * the login box to a rectangle red outline the height of the character logo on
 * the landing page with the length of 3 of the current outline boxes on the
 * login page. in that rectangle outline I want there to be only the
 * perpedicular left dashed lines with the same margins it currently has with
 * text that will alternate and a sigil which left edge should line up with
 * where the next instance of typed text will be."
 *
 * So the rectangle holds ONE ROW OF THE OLD BOX, at the old box's own scale and
 * margins: the dashed vertical rule that opens a row, the word above, the
 * dashed line under what is typed, and the ☁ standing at the caret. Every
 * number below is that row's, scaled off SPLASH_GEOM.parts.email — nothing here
 * is a new judgement about type size or margin except where it says so.
 *
 * WHY THE TWO REFERENCES ARE REAL PIXELS. The height is the landing page's 遠東
 * logo (lib/landing-geometry.json: 40 x 87), which is a real-CSS-px mark under
 * the site's margin rule — it is 87px on every screen. The width is three of
 * the old box, and the old box scaled with the frame (0.336 of it), so "three
 * of them" only names a number once a viewport is named. The reference is
 * 1920x947, which is already this repo's desktop reference (/dev/desktop lays
 * out at the screen's width by the available height less 85px of Chrome, which
 * is 1920x947 on the owner's 1080p screen). There the frame is 426.15 and the
 * box 143.186, so three of them is 429.56 -> 430.
 *
 * Holding it at 430 rather than at 3 x whatever-the-box-is-now is the site's
 * own rule — elements keep their drawn size and the space around them flexes —
 * and it is the only reading under which the rectangle keeps ONE proportion and
 * the type inside keeps ONE size. A window too narrow for 430 gets the width it
 * has, less the margin: see loginBoxRect().
 */

import { SPLASH_GEOM } from './splashFrames';

/** The viewport this repo measures a desktop at (see /dev/desktop). */
const REF_VH = 947;
/** The old box's width there: 0.336 of the frame, the frame being 720 x (947/1600). */
export const OLD_BOX_W = (SPLASH_GEOM.box.x1 - SPLASH_GEOM.box.x0) * 720 * (REF_VH / 1600);

/** The row's own numbers, in px of the old box. The email row is the model: it
 *  is the row that takes text, and its rule is the one textX0 was measured off. */
const E = SPLASH_GEOM.parts.email;
const px = (f: number) => f * OLD_BOX_W;

export const LOGIN_BOX = {
  /** 3 x the old box, to the whole pixel. */
  w: Math.round(3 * OLD_BOX_W),
  /** the landing page's 遠東 logo, which is 87 real px at every width. */
  h: 87,
  /** the site's red rule, the weight the cigarette page frames its info with.
   *  The artwork's own box draws 2.7px down its sides and 5.3 across its top
   *  and bottom (4 and 8 of the 640-wide frame); one weight for a rectangle,
   *  and 5 is inside that pair and is the weight every other red rule here has. */
  rule: 5,
  /** "a second rectangle outline on the inner edge of the red one this one in
   *  black" — the reservoir the row's ink drains into and grows back out of. */
  inner: 2,
} as const;

/**
 * THE VERTICAL RULE RUNS THE HEIGHT OF THE ROW.
 *
 * The owner's 2026-09-20 follow-up: "extend the vertical dashed line so the
 * top and bottom margins match the left margins", and then, when the first
 * cut measured those margins from the rectangle's outer edge: "make sure the
 * top and bottom of the vertical dashed lane both have the same margins with
 * the black outline".
 *
 * So the margin is measured from the BLACK OUTLINE, not from the red one, and
 * the same margin is held on all three sides. The left one is the old box's
 * own 0.100 held as the absolute distance it was — 14.32px from the outer
 * edge, which is 7.32 inside the black — so the rule runs from 7 + 7.32 to
 * 80 − 7.32 and is 58.36px tall.
 *
 * IT IS A WHOLE NUMBER OF TILES, AND THE TILE GIVES THE FRACTION. The drawn
 * mark is a 10.31px length of dashed line whose ink runs edge to edge (sprite
 * rows 63..93 of a 63..94 window, so a dash meets a dash at every join and the
 * repeat is seamless) — but a PARTIAL tile is cut mid-dash, which leaves one
 * end of the rule with a stub where the other has a full dash. The span wants
 * 5.66 of them, so six are used and each is squeezed by 5.6% to fit: both ends
 * are a whole dash, all three margins are the same 7.32, and what it costs is
 * a dash pattern a twentieth shorter than drawn. Squeezing a drawn line along
 * its own length is what the search bar already does to this same sprite.
 */
const MAX_ASC = 781; // I
const MAX_DESC = 78; // P
const TYPE_EM = px(E.y1 - E.y0) / ((703 + 78) / 1000);
const BAND = ((MAX_ASC + MAX_DESC) / 1000) * TYPE_EM;
const RULE_DRAWN = px(E.dY0 - E.y0);
const RULE_MARGIN = px(E.x0) - (LOGIN_BOX.rule + LOGIN_BOX.inner);
const RULE_H = LOGIN_BOX.h - 2 * (LOGIN_BOX.rule + LOGIN_BOX.inner) - 2 * RULE_MARGIN;
const RULE_TILES = Math.max(1, Math.round(RULE_H / RULE_DRAWN));
const RULE_TILE = RULE_H / RULE_TILES;
/**
 * How much of the rule the ☁ is. Measured off the row the owner approved —
 * a ten-digit number, where the mark had come down to 69.4 x 33.1 — and then
 * held there whatever is typed.
 */
const SIGIL_OF_RULE = 0.5665;
const RULE_TOP = LOGIN_BOX.rule + LOGIN_BOX.inner + RULE_MARGIN;

/** Where the row's marks sit, in px, from the rectangle's OUTER top-left. */
export const LOGIN_ROW = {
  /** the dashed vertical rule that opens the row — "the same margins it
   *  currently has", which is the old box's own 0.100 and 0.900, kept as the
   *  absolute distance it was rather than as a tenth of a much wider box. */
  ruleX: px(E.x0),
  ruleW: px(E.ruleX1 - E.x0),
  ruleTop: RULE_TOP,
  ruleH: RULE_H,
  /** one tile of the drawn rule, which is repeated down the new length —
   *  EXTENDED, as the owner asked, not stretched: a dashed line made longer
   *  gains dashes, it does not gain longer dashes. */
  ruleTile: RULE_TILE,
  ruleTiles: RULE_TILES,
  /** how much the drawn tile is squeezed along its length to make them fit */
  ruleSqueeze: RULE_TILE / RULE_DRAWN,
  /**
   * Where the word and what is typed both begin.
   *
   * THE GAP AFTER THE RULE IS THE GAP THE RULE KEEPS FROM THE BLACK OUTLINE
   * (the owner's "make sure the margin between the user typed text and the
   * vertical dashed line is the same as between the vertical dashed line and
   * the black outline rectangle"). One margin, 7.32, four times over: the
   * outline to the rule on three sides, and the rule to the type. The old
   * box's own 0.0023-of-a-box gap (0.33px) was drawn for a row a third as
   * tall and left the type touching the rule at this size.
   */
  textX: px(E.x0) + px(E.ruleX1 - E.x0) + RULE_MARGIN,
  /** the dashed line under the typing stops here, the same margin as the left. */
  lineX1: Math.round(3 * OLD_BOX_W) - px(E.x0),
  /**
   * THE DASHED LINE IS MADE BY THE TYPING, one piece per letter (the owner's
   * "as the user types each letter should create a piece of the dashed lines
   * underneath the newly typed letter that is the same length as the letter's
   * width"). So the sprite's own dashes are not shown — what is inherited from
   * them is the line's WEIGHT and where it sits relative to the rule's foot,
   * read off blackbox.webp: the email row's line is sprite rows 96..100 of
   * 430, which at the box's 143.186 is 1.665px thick and starts 0.77px below
   * the rule's foot (dY0 = sprite row 93.7).
   *
   * The gaps between the pieces are the letters' own side bearings, which is
   * what makes a row of them read as a dashed line at all — pieces cut to each
   * letter's ADVANCE would meet and draw one continuous rule.
   *
   * It sits under WHAT IS TYPED, which is the rule's height, so it rides the
   * foot of that band — the drawing's own gap between a label's band and its
   * dashes is 0.76px, and that is what is kept.
   */
  dashDrop: (96 / 430 - E.dY0) * OLD_BOX_W,
  dashStroke: (5 / 430) * OLD_BOX_W,
  /**
   * THE ☁ NEVER CHANGES SIZE (the owner's "keep the exact top and bottom
   * margins and scale that the sigil currently has permanently", pointing at
   * a row with a ten-digit number in it).
   *
   * It rode the type for a while — the same height as whatever it stood
   * beside — which meant it grew and shrank with every character. The size it
   * had at a full line is the size it keeps: 0.5665 of the vertical rule, so
   * 69.4 x 33.1 with 27.0 above and below. Stated as a fraction of the rule
   * rather than as two numbers, because everything else in this row is, and
   * because the rule is the one measurement the box is laid out from.
   *
   * It is fixed furniture now and the TYPE is what gives: see LOGIN_TYPED.
   */
  sigilH: RULE_H * SIGIL_OF_RULE,
  sigilW: RULE_H * SIGIL_OF_RULE * (126 / 60),
  sigilTop: (LOGIN_BOX.h - RULE_H * SIGIL_OF_RULE) / 2,
  sigilAspect: 126 / 60,
} as const;

/**
 * THE ROW'S TYPE: ONE SIZE FOR EVERY WORD, CENTRED IN THE BOX.
 *
 * The owner's 2026-09-20 correction, after a round at the rule's full height:
 * "revert the phone # text to the original size just center it on the vertical
 * axis and use that same text size for each new text element."
 *
 * The original size is the one the old box set a row in, matched by INK as the
 * shelf and the cigarette pages match all their type: PHONE #'s ink is the
 * label band the drawing gives it (10.31px), and its tallest and deepest
 * characters are the H's 703 and the P's 78, so its point size is 13.20. That
 * one size is then used for every word — which is what the instruction asks
 * for, and is also the only way a prompt can become an answer in the same
 * place without the line jumping as it does.
 *
 * THE BAND THAT IS CENTRED IS THE FACE'S, NOT ANY ONE WORD'S. Centring each
 * word's own ink would move the baseline between PHONE # and EMAIL, because
 * one has a descender and the other has none. The band is the tallest ascent
 * the face carries (the I's 781) over the deepest descent (the P's 78), so the
 * baseline is fixed, no character can leave the band, and every word sits on
 * the one line.
 */

export const LOGIN_TYPE = {
  em: TYPE_EM,
  /** the common ink band, centred on the box's own middle */
  band: BAND,
  top: LOGIN_BOX.h / 2 - BAND / 2,
  baseline: LOGIN_BOX.h / 2 - BAND / 2 + (MAX_ASC / 1000) * TYPE_EM,
  /**
   * The room one line of it has — LESS THE ☁ AND THE SPACE BEFORE IT, because
   * the mark has to stand at the end of the line too. At this size it never
   * bites on a prompt (VERIFICATION CODE, the longest, wants 143 of 360) and
   * only on a typed run of forty characters or more.
   */
  lineW: Math.round(3 * OLD_BOX_W) - 2 * px(E.x0) - (px(E.textX0) - px(E.x0))
    - BAND * (126 / 60) - 0.32 * TYPE_EM,
  /** under this it stops reading, whatever the room (the site's own floor) */
  min: 9,
} as const;

/**
 * WHAT THE READER TYPES IS AS TALL AS THE VERTICAL DASHED LINE (the owner's
 * "make all user typed text the same height as the dashed line as well"), on
 * the same axis as the prompt it replaces.
 *
 * So the row carries TWO sizes, and deliberately: the prompt is the old box's
 * own 13.20 (LOGIN_TYPE, the owner's revert), and the answer is the rule's
 * full height. They share the box's middle line, so the small grey word gives
 * way to a large black one in the same place — which is the picture, the
 * prompt being a whisper and the answer being the thing.
 *
 * THE ☁ IS FIXED FURNITURE AND THE TYPE IS WHAT GIVES. The mark never changes
 * size, so its 122.6px is taken off the line before the type is fitted at all
 * — a third of it, spoken for. A six-digit code then comes out at 54 of the
 * rule's 58; a ten-digit number at 33; a long address smaller again, as any
 * line of type does. Reserving it is what keeps the mark off the letters:
 * left to clamp at the line's end it came down on top of the last three
 * digits, which is what the first cut of this did.
 *
 * AND IT STAYS CENTRED AS IT SHRINKS (the owner's "even as the scale of the
 * user typed words gets smaller they are still centered on the vertical
 * axis"). So what is typed hangs from `centre` — its own ink band placed
 * about the box's middle line — where the PROMPTS hang from a fixed baseline
 * instead. The two want different things and it is worth saying why: the
 * prompts are all ONE size, so a fixed baseline centres them and keeps them
 * on a line with each other; what is typed changes size with every character,
 * and a fixed baseline would walk it down the box as it shrank.
 */
export const LOGIN_TYPED = {
  em: RULE_H / ((MAX_ASC + MAX_DESC) / 1000),
  band: RULE_H,
  top: LOGIN_BOX.h / 2 - RULE_H / 2,
  baseline: LOGIN_BOX.h / 2 - RULE_H / 2 + (MAX_ASC / 1000) * (RULE_H / ((MAX_ASC + MAX_DESC) / 1000)),
  /** its own ink band is centred here, at whatever size it ends up */
  centre: LOGIN_BOX.h / 2,
  lineW: Math.round(3 * OLD_BOX_W) - px(E.x0) - (px(E.x0) + px(E.ruleX1 - E.x0) + RULE_MARGIN),
  /** the mark's own width, in px, off the line before anything is fitted */
  reserve: RULE_H * (126 / 60),
  /** and a word space between the run and the mark, which does scale */
  mark: 0.32,
  min: 9,
} as const;

/** The rule's own top: where the row's ink begins. */
export const LOGIN_ROW_TOP = RULE_TOP;

/**
 * The rectangle on screen: 430 x 87 centred on the frame's own box centre, so
 * the animation's tendrils still converge on it. On a window with no room for
 * 430 it takes what there is, less a 12px margin — the row's own edge margin
 * everywhere else on this site.
 */
export function loginBoxRect(vw: number, centreX: number, centreY: number) {
  const w = Math.min(LOGIN_BOX.w, Math.max(200, vw - 24));
  return {
    x: Math.round(centreX - w / 2),
    y: Math.round(centreY - LOGIN_BOX.h / 2),
    w: Math.round(w),
    h: LOGIN_BOX.h,
    /** everything inside is laid out against the design's 430 and slid over by
     *  this when the window is too narrow to hold it; the right-hand margin is
     *  what gives, since the row is written from the left. */
    narrow: w < LOGIN_BOX.w,
  };
}

/** The words, in the order they are asked for. */
export type LoginStep = 'phone' | 'phoneCode' | 'email' | 'emailCode' | 'password';

export const LOGIN_LABEL: Record<LoginStep, string> = {
  phone: 'PHONE #',
  phoneCode: 'VERIFICATION CODE',
  email: 'EMAIL',
  emailCode: 'VERIFICATION CODE',
  password: 'PASSWORD',
};

/**
 * A word at the row's size, shrunk to fit the line it has to stand on.
 *
 * `adv` and the two extents come from the owner's own ink table
 * (scripts/assets/far-east-ink.json), measured in Chrome at 1000 upem — the
 * same table the shelf and the cigarette pages set every line of type by.
 */
export function fitRow(
  text: string,
  ink: { asc: Record<string, number>; desc: Record<string, number>; adv: Record<string, number>; em: number },
  /** LOGIN_TYPE for a prompt, LOGIN_TYPED for what the reader types. */
  spec: {
    em: number; baseline: number; lineW: number; min: number;
    mark?: number; reserve?: number; centre?: number;
  } = LOGIN_TYPE,
) {
  let w = 0;
  for (const c of text) w += ink.adv[c] ?? 700;
  // the ☁ stands at the end of the line and never changes size, so its width
  // comes off the line before anything is fitted, and the word space after
  // the run — which does scale — is counted with the run
  const room = Math.max(1, spec.lineW - (spec.reserve ?? 0));
  const advEm = w / ink.em + (spec.mark ?? 0);
  const size = advEm * spec.em > room
    ? Math.max(spec.min, room / Math.max(1e-6, advEm))
    : spec.em;
  let a = 0;
  let d = 0;
  for (const c of text) {
    a = Math.max(a, ink.asc[c] ?? 700);
    d = Math.max(d, ink.desc[c] ?? 0);
  }
  return {
    size,
    // the run's OWN width: `advEm` above carries the mark's room as well, which
    // is for solving the size and is not part of the text
    w: (w / ink.em) * size,
    ascent: (a / ink.em) * size,
    drop: (d / ink.em) * size,
    /**
     * Where its ink sits. `centre` places the run's OWN band about a line, so
     * it stays centred at whatever size it has shrunk to; without it the run
     * hangs from a fixed baseline, which is what keeps the five prompts — all
     * one size — on a line with one another.
     */
    top: spec.centre !== undefined
      ? spec.centre - (((a + d) / ink.em) * size) / 2
      : spec.baseline - (a / ink.em) * size,
    h: ((a + d) / ink.em) * size,
  };
}
