import { clusterBox, marginsOf, type ArtPageSpec, type ArtPart, type Box } from './artpage';

/**
 * The layout shared by About Us, Privacy Policy and Terms of Service.
 *
 * All three are the same template: the logo top-left, the seal top-right,
 * one or two body blocks centred below them, and a row of three footer
 * buttons centred at the foot. What differs is the body copy and which
 * footer button is blacked out, and neither of those touches the layout.
 *
 * As on the landing page, the design's margins are held in real pixels at
 * any width and the space between elements flexes; the artwork is never
 * scaled to fit. Every box comes from the generated geometry, so nothing
 * here needs changing when an artwork is re-exported.
 */
type Geometry = {
  viewBox: { w: number; h: number };
  background: string;
  parts: Record<string, Box>;
};

/**
 * Everywhere but the landing page and the splash, the 遠東 logo goes home.
 * `/landing` rather than `/`, so a signed-out reader lands on the page
 * rather than back behind the sign-in splash.
 */
export const HOME = '/landing';

const NAV_IDS = ['navAbout', 'navTerms', 'navPrivacy'] as const;

const NAV_LABELS: Record<(typeof NAV_IDS)[number], string> = {
  navAbout: 'About us',
  navTerms: 'Terms of service',
  navPrivacy: 'Privacy policy',
};

const NAV_HREFS: Record<(typeof NAV_IDS)[number], string> = {
  navAbout: '/about',
  navTerms: '/terms',
  navPrivacy: '/privacy',
};

export function innerPageSpec(
  geometry: Geometry,
  { page, bodyIds, active }: { page: string; bodyIds: string[]; active: (typeof NAV_IDS)[number] },
): ArtPageSpec {
  const { viewBox, background, parts } = geometry;
  const src = (id: string) => `/${page}/parts/${id}.svg`;
  const M = marginsOf(viewBox, Object.values(parts));
  const cluster = clusterBox(NAV_IDS.map((id) => parts[id]));
  const both = <T,>(p: T) => ({ mobile: p, desktop: p });

  const anchored = (
    id: string,
    label: string,
    placement: NonNullable<ArtPart['placement']>,
    pressable = true,
    href?: string,
  ): ArtPart => ({
    id,
    label,
    src: src(id),
    w: parts[id].w,
    h: parts[id].h,
    pressable,
    href,
    placement,
  });

  const lastBody = parts[bodyIds[bodyIds.length - 1]];

  return {
    background,
    // white, so a focus ring reads against the red ground
    focus: '#ffffff',
    minHeight: lastBody.y + lastBody.h + 60 + cluster.h + M.bottom,
    cluster: {
      w: cluster.w,
      h: cluster.h,
      placement: both({ centreX: true, bottom: M.bottom }),
    },
    parts: [
      anchored('logo', '遠東 — home', both({ left: M.left, top: parts.logo.y }), true, HOME),
      anchored('seal', 'Seal', both({ right: M.right, top: M.top })),
      // the body is a picture of the page's own words; the buttons carry the
      // meaning, so a screen reader is not read the artwork twice
      ...bodyIds.map((id) => anchored(id, '', both({ centreX: true, top: parts[id].y }), false)),
      ...NAV_IDS.map(
        (id): ArtPart => ({
          id,
          label: NAV_LABELS[id],
          src: src(id),
          w: parts[id].w,
          h: parts[id].h,
          pressable: true,
          // the box for this page says where you are; the other two lead away
          ...(id === active
            ? { current: true as const }
            : { href: NAV_HREFS[id], hoverSrc: src(`${id}-hover`) }),
          inCluster: { left: parts[id].x - cluster.x, top: parts[id].y - cluster.y },
        }),
      ),
    ],
  };
}
