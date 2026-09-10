import geometry from './landing-geometry.json';

/**
 * Layout for the landing page.
 *
 * The design was drawn on a 390 x 844 phone, and what carries it is not the
 * grid but the margins: every mark is a fixed distance from an edge of the
 * page. So the page is not one flat image scaled to fit — each element is its
 * own file, positioned against the viewport's own edges, and those distances
 * are held in real pixels at any width. Scaling the whole artwork instead
 * would scale the margins with it, which is the thing to avoid.
 *
 * MARGINS below are measured off a render of the export, not read off the
 * Figma layer boxes — those are padded, and the top-left logo's is a 116 x 116
 * image rect that is mostly empty around the two characters.
 *
 * Element boxes come from lib/landing-geometry.json, which `npm run
 * build:landing` writes when it cuts the export into parts. Nothing here
 * hardcodes a size; if the artwork is re-exported and a mark changes size, the
 * layout follows it.
 */
export type LandingDevice = 'mobile' | 'desktop';

const { viewBox, parts } = geometry;

export const LANDING_VIEWBOX = viewBox;

/** Distances from the artwork's edges to the outermost marks, in CSS px. */
export const LANDING_MARGINS = {
  /** the seal; the logo sits 4px lower at 28 */
  top: parts.seal.y,
  /** the seal again, on the right */
  right: viewBox.w - (parts.seal.x + parts.seal.w),
  /** the square at the foot of the bottom cluster */
  bottom: viewBox.h - (parts.square.y + parts.square.h),
  /** the logo, which reaches 2px further left than the text column */
  left: parts.logo.x,
  /** where OFFERS / My Saved / RECOMMENDED start */
  column: parts.offers.x,
} as const;

/**
 * TEST YOUR LUCK, the cloud and the square read as one mark, so they move as
 * one: the cluster is placed, and they keep their positions inside it. Its
 * box is derived from the three parts rather than stated, so it cannot drift
 * out of step with the artwork.
 */
const CLUSTER_IDS = ['luck', 'cloud', 'square'] as const;
const clusterBoxes = CLUSTER_IDS.map((id) => parts[id]);
const clusterX = Math.min(...clusterBoxes.map((b) => b.x));
const clusterY = Math.min(...clusterBoxes.map((b) => b.y));

export const LANDING_CLUSTER = {
  w: Math.max(...clusterBoxes.map((b) => b.x + b.w)) - clusterX,
  h: Math.max(...clusterBoxes.map((b) => b.y + b.h)) - clusterY,
  /** it is centred in the design: 111 to the left, 110 to the right */
  centred: true,
} as const;

export type Placement = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  centreX?: boolean;
};

export type LandingPart = {
  id: string;
  /** what a screen reader announces; also names the destination */
  label: string;
  src: string;
  w: number;
  h: number;
  /** false for the two marks that decorate the cluster rather than act */
  pressable: boolean;
  /** offsets inside the cluster, for the three that belong to it */
  inCluster?: { left: number; top: number };
  placement?: Record<LandingDevice, Placement>;
};

const M = LANDING_MARGINS;
const part = (id: keyof typeof parts) => parts[id];

/**
 * Mobile and desktop are described separately on purpose.
 *
 * They hold the same margins today, because holding them is the requirement —
 * what changes between the two is where the viewport's edges are, so the same
 * distances put the seal beside the logo on a phone and across the page on a
 * desktop. Keeping them as two tables means either can be re-composed later
 * without touching the other, and the choice is made on the server so the page
 * arrives already in the right arrangement rather than snapping into it.
 */
export const LANDING_PARTS: LandingPart[] = [
  {
    id: 'logo',
    label: '遠東',
    src: '/landing/parts/logo.svg',
    w: part('logo').w,
    h: part('logo').h,
    pressable: true,
    placement: {
      mobile: { left: M.left, top: part('logo').y },
      desktop: { left: M.left, top: part('logo').y },
    },
  },
  {
    id: 'seal',
    label: 'Seal',
    src: '/landing/parts/seal.svg',
    w: part('seal').w,
    h: part('seal').h,
    pressable: true,
    placement: {
      mobile: { right: M.right, top: M.top },
      desktop: { right: M.right, top: M.top },
    },
  },
  {
    id: 'offers',
    label: 'Offers',
    src: '/landing/parts/offers.svg',
    w: part('offers').w,
    h: part('offers').h,
    pressable: true,
    placement: {
      mobile: { left: M.column, top: part('offers').y },
      desktop: { left: M.column, top: part('offers').y },
    },
  },
  {
    id: 'saved',
    label: 'My Saved',
    src: '/landing/parts/saved.svg',
    w: part('saved').w,
    h: part('saved').h,
    pressable: true,
    placement: {
      mobile: { left: M.column, top: part('saved').y },
      desktop: { left: M.column, top: part('saved').y },
    },
  },
  {
    id: 'recommended',
    label: 'Recommended',
    src: '/landing/parts/recommended.svg',
    w: part('recommended').w,
    h: part('recommended').h,
    pressable: true,
    placement: {
      mobile: { left: M.column, top: part('recommended').y },
      desktop: { left: M.column, top: part('recommended').y },
    },
  },
  {
    id: 'luck',
    label: 'Test your luck',
    src: '/landing/parts/luck.svg',
    w: part('luck').w,
    h: part('luck').h,
    pressable: true,
    inCluster: { left: part('luck').x - clusterX, top: part('luck').y - clusterY },
  },
  {
    id: 'cloud',
    label: '',
    src: '/landing/parts/cloud.svg',
    w: part('cloud').w,
    h: part('cloud').h,
    pressable: false,
    inCluster: { left: part('cloud').x - clusterX, top: part('cloud').y - clusterY },
  },
  {
    id: 'square',
    label: '',
    src: '/landing/parts/square.svg',
    w: part('square').w,
    h: part('square').h,
    pressable: false,
    inCluster: { left: part('square').x - clusterX, top: part('square').y - clusterY },
  },
];

/** Where the cluster itself goes. */
export const LANDING_CLUSTER_PLACEMENT: Record<LandingDevice, Placement> = {
  mobile: { centreX: true, bottom: M.bottom },
  desktop: { centreX: true, bottom: M.bottom },
};

/**
 * The tallest the composition can get before the top block and the bottom
 * cluster would meet. Below this the page scrolls rather than overlapping.
 */
export const LANDING_MIN_HEIGHT =
  part('recommended').y + part('recommended').h + 80 + LANDING_CLUSTER.h + M.bottom;
