import cigs from './cigs.json';
import cigpages from './cigpages.json';

/**
 * Which page a pack on the landing row opens.
 *
 * The owner supplied one info-page vector per cigarette *name*, but the
 * photographs run ahead of that: twelve packs carry a name another pack
 * already has — `299_Karelia-Blue` and `252_Karelia-Blue`, `111_GoldenLeaf-
 * Love_Style` and `42_Golden_Leaf-Love_Style`, and ten more. The build gives
 * the vector to whichever asks first, which left the other twelve as packs
 * you could see and not press.
 *
 * They are the same cigarette, so they get the same page. Matching is on the
 * name with the punctuation and spacing taken out, which is what makes
 * `GoldenLeaf` and `Golden Leaf` meet — the two spellings the audit flagged
 * and the owner has not yet settled. If those names are ever pulled apart
 * into genuinely different products, each will claim its own vector and this
 * will quietly find nothing to do.
 *
 * A name that somehow matched two pages would be ambiguous, so it is left
 * alone rather than guessed at.
 */
type Page = (typeof cigpages.pages)[number];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const byId = new Map<string, Page>(cigpages.pages.map((p) => [p.id, p]));

const byName = new Map<string, Page[]>();
for (const page of cigpages.pages) {
  const k = key(page.name);
  const held = byName.get(k);
  if (held) held.push(page);
  else byName.set(k, [page]);
}

/** Pack id -> the page it stands in for, for the twelve without one. */
export const TWINS: Record<string, string> = {};
for (const pack of cigs.packs) {
  if (byId.has(pack.id)) continue;
  const match = byName.get(key(pack.name));
  if (match?.length === 1) TWINS[pack.id] = match[0].id;
}

/** Every pack id that leads somewhere, which the row uses to decide a button. */
export const PRESSABLE: string[] = [
  ...cigpages.pages.map((p) => p.id),
  ...Object.keys(TWINS),
];

/** The page a pack id opens, its own or its twin's. */
export function pageFor(id: string): Page | null {
  return byId.get(id) ?? byId.get(TWINS[id] ?? '') ?? null;
}

/**
 * The box the info content occupies, in the body's own coordinates.
 *
 * Everything on the page below the 遠東 logo and the seal: the title block
 * down to the foot of the two comment panels. The numbers are the design's,
 * and they are the same on every page — which is only true because the build
 * puts the title block on the landing page's own line, so its ink top is 161
 * whatever the brand name is. They come from `scripts/lib/cigpage-layout.mjs`:
 *
 *   left    TITLE_X 44 - FRAME.x 39
 *   top     TITLE_TOP 161 - FRAME.y 18
 *   right   the notes strip ends the design at 343
 *   bottom  the comment panels end it at 730, which is FRAME's own foot
 *
 * If any of those move, move these with them.
 */
export const INFO_BOX = { left: 5, top: 143, width: 299, height: 569 };

/**
 * The bookmark, which the page draws rather than the vector.
 *
 * The owner asked for it to be a button: black at rest, red under the
 * pointer, red for good once it has been pressed. An SVG loaded through
 * <img> cannot be reached by the page's CSS, so the mark comes out of the
 * artwork the way the logo and the seal already do, and is drawn here
 * instead. The build strips it — see stripBookmark in
 * scripts/build-cigpages.mjs — and it is the same shape in all 227 supplied
 * vectors, to the character.
 *
 * All four numbers are the design's own, moved into the body's coordinates
 * by the crop (x-39, y-18) and rounded outward, so nothing lands on a half
 * pixel. In the vector:
 *
 *   box   <rect x="182" y="331.5" width="68" height="63" stroke-width="3">
 *         which the 3px stroke straddles, so it occupies 180.5..251.5 and
 *         330..396 — 141.5..212.5 and 312..378 on the body
 *   mark  <path d="M199 344 H233 V382 L216 369 L199 382 Z">
 *         160..194 and 326..364 on the body, 34 by 38
 *
 * THE BOX IS THE BUTTON, not the mark: it is what the design draws as a
 * control, it is what the plus beside it is, and a 34px target is under the
 * 44px a finger wants. The mark is what changes colour.
 */
export const BOOKMARK = {
  /** The drawn box, outer edge of its rule. The hit area. */
  box: { left: 141, top: 312, width: 72, height: 66 },
  /** The mark inside it, in the body's coordinates. */
  mark: { left: 160, top: 326, width: 34, height: 38 },
  /** The same path, moved to its own origin so the svg needs no viewBox maths. */
  d: 'M0 0 H34 V38 L17 25 L0 38 Z',
};

/** The rule's weight, which globals.css draws and the page has to allow for. */
export const RULE = 5;

/** A carton or a pack — what the plus button's right-hand wheel offers. */
export type PackUnit = 'C' | 'P';

/**
 * The plus beside the bookmark, which opens the quantity menu.
 *
 * The same box as the bookmark's, 91px to its right, straight out of the
 * vector: <rect x="273" y="331.5" width="68" height="63" stroke-width="3">,
 * outer edge 271.5..342.5 and 330..396, which is 232..304 and 312..378 on the
 * body. Byte-identical in all 235 built pages, along with the two bars that
 * draw the plus and the notes strip below — checked, not assumed.
 *
 * Unlike the bookmark, the mark itself stays in the artwork: nothing about
 * it changes colour, so there is nothing for a stylesheet to reach. Only the
 * hit area is the page's.
 */
export const PLUS = {
  box: { left: 232, top: 312, width: 72, height: 66 },
  /** The box's own rule, from the vector: stroke-width="3". The menu borrows it. */
  stroke: 3,
};

/**
 * The quantity menu: from the info rule's top-left corner to the foot of the
 * notes strip, the full width of the rule. The owner's words, and the
 * numbers are the artwork's — the strip is
 * <rect x="180.5" y="408" width="162.5" height="24" fill="#FF0000">, whose
 * foot is 432 in the vector and 414 on the body. It lies over the title, the
 * pack, the prices, the bookmark and the plus, and while it is open none of
 * them can be pressed, which is the point of it being solid.
 */
export const QUANTITY_MENU = {
  left: INFO_BOX.left,
  top: INFO_BOX.top,
  width: INFO_BOX.width,
  height: 414 - INFO_BOX.top,
  /**
   * A black rule round it, the same weight as the plus box's own, so it reads
   * as that outline having grown out into the menu — the owner's image for it.
   * Drawn inside the box (border-box), so the outer edge is still the corner
   * the menu grows from.
   */
  stroke: PLUS.stroke,
};

/**
 * The two wheels, as white stripes down the menu.
 *
 * Each is a fifth of the menu's width, and the three gaps — edge, between,
 * edge — share what is left equally, which is what the owner asked for. The
 * same gap is held above and below, so the stripes sit in the menu the way
 * they sit across it. Three item slots tall, the middle one being the window
 * the chosen value sits in.
 */
export type QuantityBox = { left: number; top: number; width: number; height: number };

/**
 * The wheels for a menu of a given box: two stripes a fifth of the inner width
 * each, the three gaps sharing what is left, full inner height so they touch
 * the red top and bottom, and the window the centred slot. Laid out on the
 * area INSIDE the menu's rule — an absolutely placed child sits inside the
 * border, so these are the numbers it actually uses. A function rather than
 * a constant because the shelf opens the same menu in a much smaller box.
 */
export function wheelFor(menu: QuantityBox, stroke: number, pitch: number) {
  const innerW = menu.width - stroke * 2;
  const innerH = menu.height - stroke * 2;
  const width = Math.round(innerW / 5);
  const gap = (innerW - width * 2) / 3;
  return {
    width,
    pitch,
    height: innerH,
    top: 0,
    lefts: [Math.round(gap), Math.round(gap * 2 + width)] as const,
    /** The window — the centred slot the chosen value sits in, cut to the red. */
    window: Math.round(innerH / 2 - pitch / 2),
  };
}
export const WHEEL = wheelFor(QUANTITY_MENU, QUANTITY_MENU.stroke, 50);

/**
 * Everything the quantity menu needs to know about where it lives: the plus
 * that opens it, the box it fills, the rule it borrows, and how big its
 * values are. The cigarette page's is the original; the shelf makes its own
 * from its row, in the row's coordinates.
 */
export type QuantityFrame = {
  plus: QuantityBox;
  menu: QuantityBox;
  stroke: number;
  pitch: number;
  fontSize: number;
};
export const PAGE_QUANTITY_FRAME: QuantityFrame = {
  plus: PLUS.box,
  menu: { left: QUANTITY_MENU.left, top: QUANTITY_MENU.top, width: QUANTITY_MENU.width, height: QUANTITY_MENU.height },
  stroke: QUANTITY_MENU.stroke,
  pitch: 50,
  fontSize: 40,
};
