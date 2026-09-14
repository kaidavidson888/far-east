import geometry from './landing-geometry.json';
import { clusterBox, marginsOf, type ArtPageSpec, type ArtPart } from './artpage';

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
 * THE PAIR SITS UNDER THE SEAL, AS WIDE AS THE SEAL. The owner's next ask:
 * "put the sigil and the outline under the seal logo and scale it so it fits
 * within the sides of the seal", with "a margin between them equal to the one
 * between the my saved and recommended". So the pair is scaled as one until
 * its width is the seal's (the seal button's drawn size, the logo's height),
 * each mark rounded to whole pixels with the square held to the right edge so
 * the width comes out exact; hung from the seal's own right margin; and set
 * below the seal by the design's gap from the foot of My Saved to the top of
 * RECOMMENDED. The marks are vectors, so they stay sharp at the new size.
 */
const SIGIL_GAP = 5;
const SEAL_SIZE = parts.logo.h;
const LABEL_GAP = parts.recommended.y - (parts.saved.y + parts.saved.h);
const cluster = (() => {
  const drawnW = parts.cloud.w + SIGIL_GAP + parts.square.w;
  const k = SEAL_SIZE / drawnW;
  const square = { w: Math.round(parts.square.w * k), h: Math.round(parts.square.h * k) };
  const cloud = { w: Math.round(parts.cloud.w * k), h: Math.round(parts.cloud.h * k) };
  const marks = {
    cloud: { x: 0, y: Math.round((parts.cloud.y - parts.square.y) * k), ...cloud },
    square: { x: SEAL_SIZE - square.w, y: 0, ...square },
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
  SEAL_SIZE +
  LABEL_GAP +
  Math.round(OUTLINE_STROKE * cluster.scale - OFFERS_CROWN * (OFFERS.h / parts.offers.h));
const OFFERS_TO_SAVED = parts.saved.y - (parts.offers.y + parts.offers.h);
const LABELS = {
  offers: LABEL_TOP,
  saved: LABEL_TOP + OFFERS.h + OFFERS_TO_SAVED,
  recommended: LABEL_TOP + OFFERS.h + OFFERS_TO_SAVED + parts.saved.h + LABEL_GAP,
};
/** The page y the cigarette row must keep clear of: the column's foot plus the design's gap. See cigZoom. */
export const LANDING_ROW_CLEAR = LABELS.recommended + parts.recommended.h + LABEL_GAP;

const inCluster = (id: keyof typeof CLUSTER, label: string, pressable: boolean): ArtPart => ({
  id,
  label,
  src: `/landing/parts/${id}.svg`,
  w: CLUSTER[id].w,
  h: CLUSTER[id].h,
  pressable,
  inCluster: { left: CLUSTER[id].x - cluster.x, top: CLUSTER[id].y - cluster.y },
});

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
  sealSize: parts.logo.h,
  minHeight: parts.recommended.y + parts.recommended.h + 80 + cluster.h + M.bottom,
  cluster: {
    w: cluster.w,
    h: cluster.h,
    placement: both({ right: M.right, top: M.top + SEAL_SIZE + LABEL_GAP }),
  },
  parts: [
    anchored('logo', '遠東', both({ left: M.left, top: parts.logo.y })),
    anchored('seal', 'Seal', both({ right: M.right, top: M.top })),
    anchored('offers', 'Offers', both({ left: parts.offers.x, top: LABELS.offers }), OFFERS),
    anchored('saved', 'My Saved', both({ left: parts.saved.x, top: LABELS.saved })),
    anchored(
      'recommended',
      'Recommended',
      both({ left: parts.recommended.x, top: LABELS.recommended }),
    ),
    inCluster('cloud', '', false),
    inCluster('square', '', false),
  ],
};
