/**
 * Shared layout model for pages built from a supplied design image.
 *
 * The rule these pages follow: measure the distance from each edge of the
 * design to the outermost ink, and hold those distances in real CSS pixels at
 * every viewport size. Elements keep their drawn size and the space between
 * them flexes. The artwork is never scaled to fit a frame, because that
 * scales the margins with it — which is the thing being avoided.
 *
 * Each page supplies an ArtPageSpec built from its generated geometry JSON.
 * No size is written by hand, so re-exporting an artwork moves the buttons
 * with the marks.
 */
export type ArtDevice = 'mobile' | 'desktop';

export type ArtPlacement = {
  /** distance from the named viewport edge, in CSS px */
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  /** centre on the stage instead of anchoring to a side */
  centreX?: boolean;
};

export type ArtPart = {
  id: string;
  /** what a screen reader announces; also names the destination */
  label: string;
  src: string;
  w: number;
  h: number;
  /** false for marks that decorate rather than act */
  pressable: boolean;
  /** where it goes; without one it renders as a button with no destination */
  href?: string;
  /** a second image shown while hovered — the black-filled footer boxes */
  hoverSrc?: string;
  /** the footer button for the page you are already on */
  current?: boolean;
  /** set for parts that belong to the page's cluster */
  inCluster?: { left: number; top: number };
  /** set for parts placed against the stage directly */
  placement?: Record<ArtDevice, ArtPlacement>;
};

export type ArtPageSpec = {
  /** the page's own ground, so backing plates in the art cannot seam */
  background: string;
  /** focus ring and debug outline colour, for contrast against the ground */
  focus: string;
  /** below this the page scrolls rather than letting blocks overlap */
  minHeight: number;
  parts: ArtPart[];
  /** marks that read as one thing and move together */
  cluster?: {
    w: number;
    h: number;
    placement: Record<ArtDevice, ArtPlacement>;
  };
};

export type Box = { x: number; y: number; w: number; h: number };

/** The margins a design keeps between its edges and its outermost marks. */
export function marginsOf(viewBox: { w: number; h: number }, boxes: Box[]) {
  return {
    top: Math.min(...boxes.map((b) => b.y)),
    right: Math.min(...boxes.map((b) => viewBox.w - (b.x + b.w))),
    bottom: Math.min(...boxes.map((b) => viewBox.h - (b.y + b.h))),
    left: Math.min(...boxes.map((b) => b.x)),
  };
}

/** The bounding box of a group of marks that move together. */
export function clusterBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}
