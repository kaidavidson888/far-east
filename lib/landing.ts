import geometry from './landing-geometry.json';
import { clusterBox, marginsOf, type ArtPageSpec, type ArtPart } from './artpage';
// the plus button that opens the tag filter — the seal and the sigil pair are
// both drawn at its size now, and this is the one copy of that number
import { CIG_CONTROLS } from './cigRow';

/**
 * The landing page's layout.
 *
 * Margins are measured off a render of the export by `npm run build:landing`,
 * not read off the Figma layer boxes — those are padded, and the logo's is a
 * 116x116 image rect mostly empty around the two characters. Nothing here
 * hardcodes a size; re-exporting the artwork moves the buttons with the marks.
 */
const { viewBox, background, parts } = geometry;

export const LANDING_MARGINS = marginsOf(viewBox, Object.values(parts));

/**
 * The cloud and the square read as one mark, so they move as one, centred on
 * the page. TEST YOUR LUCK was drawn above them and moved with them (the
 * design centred the three together, 111 to the left against 110 to the
 * right); the owner asked for it taken off the page. The part is still cut by
 * the build (`luck.svg`, in the geometry) and simply not placed, so putting
 * it back is one line here.
 *
 * THE SQUARE STANDS 5PX OFF THE SIGIL, not the design's 17: the owner's
 * "close the gap between the sigil and the outline to 3px", then "increase
 * to 5px". The cloud keeps its drawn place in the cluster and the square
 * comes to it.
 *
 * THE PAIR USED TO SIT UNDER THE SEAL, AS WIDE AS THE SEAL — the owner's
 * earlier ask, "put the sigil and the outline under the seal logo and scale
 * it so it fits within the sides of the seal", with "a margin between them
 * equal to the one between the my saved and recommended" (LABEL_GAP). Both
 * marks and the seal have since gone down to the plus's line (below); the
 * pair still keeps its drawn relation and its gap, at the square's scale.
 */
const SIGIL_GAP = 5;
const LABEL_GAP = parts.recommended.y - (parts.saved.y + parts.saved.h);

/**
 * THE SEAL AND THE SIGIL PAIR ARE BOTH DRAWN AT THE PLUS BUTTON'S SIZE — the
 * owner's 2026-09-17 ask, "decrease the seal logo size to the same as the +
 * outline that opens the menu", and the sigil pair scaled to match. So the one
 * number comes from `CIG_CONTROLS`, where that button's size already lives,
 * rather than being typed again here.
 *
 * AND SINCE 2026-09-19 THEY STAND ON THE PLUS'S OWN LINE ("line up the seal
 * logo and the sigil with its outline and number with the + that opens the
 * menu"): reset, the plus, the seal, the sigil, the outline, left to right
 * under the row's left end. That line is laid out by the row's controls on
 * the client — its height is the band's at the live zoom — so this module no
 * longer PLACES them; it only says how big they are (`LANDING_MARKS`, below)
 * and `CigScroller` puts them beside the plus. The top right of the page is
 * empty at rest now, which is where the logo menu's words unfold.
 *
 * WHAT IS SCALED TO IT IS THE SQUARE, NOT THE PAIR, and that is a judgement
 * worth stating. The pair scaled to 30 wide would put the square at 12.8px
 * with 11px inside its own stroke — and there is a NUMBER in there now, which
 * at that size would be about 6px of type, under the 9px this site has already
 * learned is the floor for a line that has to render solid. Scaling the square
 * to 30 leaves 26px inside it, which sets the number at 13.5. The sigil keeps
 * its drawn proportion to the square either way.
 */
const MARK_SIZE = CIG_CONTROLS.height;

/**
 * The seal's size AS THE DESIGN DREW IT, which is not what is drawn any more.
 *
 * It is kept because the three labels' arithmetic below is measured from it,
 * and that arithmetic is what `LANDING_ROW_CLEAR` — the cigarette row's
 * ceiling — is made of. The row's size was its own ask and this is what
 * decides it on a short window, so shrinking the seal deliberately does NOT
 * move it. See the note on LANDING_ROW_CLEAR.
 */
const DESIGN_SEAL = parts.logo.h;
/** And the scale the pair had at that size, frozen for the same reason. */
const DESIGN_PAIR_SCALE = DESIGN_SEAL / (parts.cloud.w + SIGIL_GAP + parts.square.w);

const cluster = (() => {
  const k = MARK_SIZE / parts.square.w;
  const square = { w: MARK_SIZE, h: Math.round(parts.square.h * k) };
  const cloud = { w: Math.round(parts.cloud.w * k), h: Math.round(parts.cloud.h * k) };
  const gap = Math.round(SIGIL_GAP * k);
  const marks = {
    // the sigil, then the outline: the owner's order, left to right
    cloud: { x: 0, y: Math.round((parts.cloud.y - parts.square.y) * k), ...cloud },
    square: { x: cloud.w + gap, y: 0, ...square },
  };
  return { marks, scale: k, ...clusterBox(Object.values(marks)) };
})();
/** The square's stroke as drawn, measured off its vector (3 of its 44); it scales with the pair. */
const OUTLINE_STROKE = 3;
/**
 * How far the O's crown rises above the flat tops of F, E, R and S in the
 * OFFERS drawing (1 of its 37, measured off the vector). The part's box
 * starts at the crown; the eye lines the word up by the flat tops.
 */
const OFFERS_CROWN = 1;
const CLUSTER = cluster.marks;

const M = LANDING_MARGINS;

/** A mark placed against the stage, in the same spot on both arrangements. */
const anchored = (
  id: keyof typeof parts,
  label: string,
  place: ArtPart['placement'],
  size: { w: number; h: number } = parts[id],
): ArtPart => ({
  id,
  label,
  src: `/landing/parts/${id}.svg`,
  w: size.w,
  h: size.h,
  pressable: true,
  placement: place,
});

const both = (p: NonNullable<ArtPart['placement']>['mobile']) => ({ mobile: p, desktop: p });

/**
 * THE THREE LABELS ARE A COLUMN WHOSE TOP IS THE OUTLINE'S, WITH OFFERS SET AT
 * MY SAVED'S SIZE. The owner's ask: "scale the offers text and button down to
 * the same size as the my saved while keeping the margins and align the top
 * of the entire row of text with the top of the outline next to the sigil
 * while keeping the same margins between the text".
 *
 * The design draws OFFERS at 51.5px and My Saved at 18.9 (each ink height
 * divided by the ink extent of the letters in it — the stylesheet's dash
 * geometry says the same). So OFFERS is scaled by 18.9/51.5, its box rounded
 * to whole pixels AT ITS OWN ASPECT — 37 tall becomes 14, and the width
 * follows, so the mark is never stretched; that lands the type at 19.5px, a
 * whole-pixel rounding away from 18.9. The column keeps its left edge and
 * the design's 13px between one line and the next (offers→saved and
 * saved→recommended are both 13), and its top is the INSIDE of the outline's
 * top edge under the seal — the owner's "inner edge": the square's top plus
 * its stroke at the pair's scale (3 × 87/103 = 2.5), the letters' flat tops
 * on that line (see LABEL_TOP). The pressable box is the mark's box, so the
 * button shrinks with it.
 */
const OFFERS_SIZE = 51.5;
const SAVED_SIZE = 18.9;
const OFFERS = (() => {
  const h = Math.round(parts.offers.h * (SAVED_SIZE / OFFERS_SIZE));
  return { w: Math.round((parts.offers.w * h) / parts.offers.h), h };
})();
/**
 * The column's top: the outline's inner edge — its outer top plus its stroke
 * at the pair's scale (2.5) — less the crown, so that it is the FLAT TOPS of
 * the letters that meet the inner edge, not the O's overshoot; then the
 * whole pixel the box has to start on. At today's sizes that is 124 + 2.5 −
 * 0.4 → 126: the letters' top edge and the stroke's inner edge both fall in
 * the same pixel row, each covering about half of it.
 */
const LABEL_TOP =
  LANDING_MARGINS.top +
  DESIGN_SEAL +
  LABEL_GAP +
  Math.round(OUTLINE_STROKE * DESIGN_PAIR_SCALE - OFFERS_CROWN * (OFFERS.h / parts.offers.h));
const OFFERS_TO_SAVED = parts.saved.y - (parts.offers.y + parts.offers.h);
const LABELS = {
  offers: LABEL_TOP,
  saved: LABEL_TOP + OFFERS.h + OFFERS_TO_SAVED,
  recommended: LABEL_TOP + OFFERS.h + OFFERS_TO_SAVED + parts.saved.h + LABEL_GAP,
};
/**
 * The page y the cigarette row must keep clear of: the column's foot plus the
 * design's gap. See cigZoom.
 *
 * THE COLUMN IS NO LONGER PRINTED ON THE PAGE (below) AND THIS LINE STAYS
 * WHERE IT WAS. The row's size was its own ask — "just big enough where only
 * 7 packs at max are visible" — and moving this would resize it on any window
 * short enough for the height to be the binding constraint, which is not
 * something that was asked for. So the arithmetic above still runs over the
 * three labels' own geometry, which the build still cuts, and the row sits
 * exactly where it sat. The menu's words reach 5px past it; on a window short
 * enough for that to meet the row's top rule, it meets it only while the menu
 * is open, and the menu is drawn over the row.
 */
export const LANDING_ROW_CLEAR = LABELS.recommended + parts.recommended.h + LABEL_GAP;

/**
 * THE SEAL, THE SIGIL AND THE OUTLINE WITH THE NUMBER IN IT — how big each is,
 * for `SealButton` and `SigilMark` to draw on the plus's line.
 *
 * The sigil and the outline are one box, the cloud then the square in the
 * relation the design drew them (the cloud sits centred on the square's
 * height) at the square's scale — `cluster` above — with the design's gap
 * between them taken to the same scale. The marks are the artwork's own cut
 * vectors, `/landing/parts/cloud.svg` and `square.svg`, so they stay sharp.
 *
 * THE NUMBER: the owner's 2026-09-17 ask, a number in the outline beside the
 * sigil counting the share links this reader has made worth $100 or more
 * (`profiles.big_shares` — see the migration and `createShare`). It is live
 * type over the square rather than part of the artwork — every cut part is
 * an `<img>` and none holds a text node — set in the owner's face like the
 * row's own controls beside it.
 *
 * ONE SIZE, TAKEN FROM THE WIDEST IT WILL EVER SHOW. "100" is 1.919em in the
 * owner's face (off `far-east-ink.json`), and the room inside the square is
 * its 30 less its own stroke at this scale (3 x 0.68 each side) — 25.9px. So
 * the type is 13.5px and it does not resize as the count climbs, which a
 * number that changed size on reaching double figures would.
 */
const COUNT_EM = 1.919;
const boxOf = (id: keyof typeof CLUSTER) => ({
  left: CLUSTER[id].x - cluster.x,
  top: CLUSTER[id].y - cluster.y,
  w: CLUSTER[id].w,
  h: CLUSTER[id].h,
});
export const LANDING_MARKS = {
  /** the seal's square: the plus's size */
  seal: MARK_SIZE,
  /** the sigil and the outline as one box, each mark's place inside it */
  sigil: {
    w: cluster.w,
    h: cluster.h,
    cloud: boxOf('cloud'),
    square: boxOf('square'),
  },
  /** the count's type size, in px */
  type: +((MARK_SIZE - 2 * OUTLINE_STROKE * cluster.scale) / COUNT_EM).toFixed(2),
};

/**
 * Mobile and desktop are described separately on purpose. They hold the same
 * margins today, because holding them is the requirement — what changes is
 * where the viewport's edges are, so the same distances put the seal beside
 * the logo on a phone and across the page on a desktop. Keeping two tables
 * means either can be re-composed later without touching the other.
 */
export const LANDING_SPEC: ArtPageSpec = {
  background,
  focus: '#010101',
  sealSize: MARK_SIZE,
  minHeight: parts.recommended.y + parts.recommended.h + 80 + cluster.h + M.bottom,
  /**
   * OFFERS, MY SAVED AND RECOMMENDED ARE NOT PLACED — THEY MOVED INTO THE
   * MENU. The owner's 2026-09-16 ask: the logo's menu was re-drawn to grow
   * branches carrying six words, three of them these, and the three standing
   * on the page were to come off it. `npm run build:growmenu` bakes that menu
   * and measures the words off its last frame; `components/LogoMenu.tsx`
   * draws it.
   *
   * THE SEAL, THE SIGIL AND THE OUTLINE ARE NOT PLACED HERE EITHER — THEY
   * STAND ON THE PLUS'S LINE (2026-09-19, see LANDING_MARKS). So the artwork
   * the page places is the logo alone; everything else on it is the row and
   * what stands under it, and everything you can press beyond those is
   * reached by hovering 遠東.
   *
   * The parts are all still cut by `npm run build:landing` and their geometry
   * is still read above — LABEL_TOP and LABELS decide where the row's ceiling
   * is and are what keeps the row exactly where it was — so putting any of
   * them back on the page is a line here, the way TEST YOUR LUCK is one.
   */
  parts: [anchored('logo', '遠東', both({ left: M.left, top: parts.logo.y }))],
};
