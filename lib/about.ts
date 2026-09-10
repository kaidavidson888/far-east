import geometry from './about-geometry.json';
import { clusterBox, marginsOf, type ArtPageSpec, type ArtPart } from './artpage';

/**
 * The About Us page's layout.
 *
 * Same rule as the landing page: the design's margins are held in real pixels
 * at any width, and the space between elements flexes. Measured off a render
 * by `npm run build:about` — 24px above the seal, 30 to its right, 43.75 left
 * of the logo, 60 under the footer row.
 *
 * The two body-text blocks and the footer row are centred in the design, so
 * they stay centred at any width rather than being pinned to a side.
 */
const { viewBox, background, parts } = geometry;

export const ABOUT_MARGINS = marginsOf(viewBox, Object.values(parts));

/** The three footer boxes read as one row, so they move as one. */
const NAV_IDS = ['navAbout', 'navTerms', 'navPrivacy'] as const;
const cluster = clusterBox(NAV_IDS.map((id) => parts[id]));

const M = ABOUT_MARGINS;

const anchored = (
  id: keyof typeof parts,
  label: string,
  placement: ArtPart['placement'],
  pressable = true,
): ArtPart => ({
  id,
  label,
  src: `/about/parts/${id}.svg`,
  w: parts[id].w,
  h: parts[id].h,
  pressable,
  placement,
});

const both = (p: NonNullable<ArtPart['placement']>['mobile']) => ({ mobile: p, desktop: p });

const inCluster = (id: (typeof NAV_IDS)[number], label: string): ArtPart => ({
  id,
  label,
  src: `/about/parts/${id}.svg`,
  w: parts[id].w,
  h: parts[id].h,
  pressable: true,
  inCluster: { left: parts[id].x - cluster.x, top: parts[id].y - cluster.y },
});

export const ABOUT_SPEC: ArtPageSpec = {
  background,
  // white, so the focus ring reads against the red ground
  focus: '#ffffff',
  minHeight: parts.focus.y + parts.focus.h + 60 + cluster.h + M.bottom,
  cluster: {
    w: cluster.w,
    h: cluster.h,
    placement: both({ centreX: true, bottom: M.bottom }),
  },
  parts: [
    anchored('logo', '遠東', both({ left: M.left, top: parts.logo.y })),
    anchored('seal', 'Seal', both({ right: M.right, top: M.top })),
    anchored('intro', '', both({ centreX: true, top: parts.intro.y }), false),
    anchored('focus', '', both({ centreX: true, top: parts.focus.y }), false),
    inCluster('navAbout', 'About us'),
    inCluster('navTerms', 'Terms of service'),
    inCluster('navPrivacy', 'Privacy policy'),
  ],
};
