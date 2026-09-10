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
 * TEST YOUR LUCK, the cloud and the square read as one mark, so they move as
 * one. The design centres them: 111 to the left against 110 to the right.
 */
const CLUSTER_IDS = ['luck', 'cloud', 'square'] as const;
const cluster = clusterBox(CLUSTER_IDS.map((id) => parts[id]));

const M = LANDING_MARGINS;

/** A mark placed against the stage, in the same spot on both arrangements. */
const anchored = (
  id: keyof typeof parts,
  label: string,
  place: ArtPart['placement'],
): ArtPart => ({
  id,
  label,
  src: `/landing/parts/${id}.svg`,
  w: parts[id].w,
  h: parts[id].h,
  pressable: true,
  placement: place,
});

const both = (p: NonNullable<ArtPart['placement']>['mobile']) => ({ mobile: p, desktop: p });

const inCluster = (id: keyof typeof parts, label: string, pressable: boolean): ArtPart => ({
  id,
  label,
  src: `/landing/parts/${id}.svg`,
  w: parts[id].w,
  h: parts[id].h,
  pressable,
  inCluster: { left: parts[id].x - cluster.x, top: parts[id].y - cluster.y },
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
  minHeight: parts.recommended.y + parts.recommended.h + 80 + cluster.h + M.bottom,
  cluster: {
    w: cluster.w,
    h: cluster.h,
    placement: both({ centreX: true, bottom: M.bottom }),
  },
  parts: [
    anchored('logo', '遠東', both({ left: M.left, top: parts.logo.y })),
    anchored('seal', 'Seal', both({ right: M.right, top: M.top })),
    anchored('offers', 'Offers', both({ left: parts.offers.x, top: parts.offers.y })),
    anchored('saved', 'My Saved', both({ left: parts.saved.x, top: parts.saved.y })),
    anchored(
      'recommended',
      'Recommended',
      both({ left: parts.recommended.x, top: parts.recommended.y }),
    ),
    inCluster('luck', 'Test your luck', true),
    inCluster('cloud', '', false),
    inCluster('square', '', false),
  ],
};
