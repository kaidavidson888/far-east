/**
 * Geometry for the landing page's pressable areas.
 *
 * Everything is in the artwork's own 390 x 844 coordinates, so the component
 * can turn them into percentages and they hold at any width.
 *
 * Each box is the bounding rectangle of the VISIBLE mark, measured off a
 * render of the export rather than taken from the Figma layer boxes — those
 * are padded, and the top-left logo's in particular is a 116 x 116 image rect
 * that is mostly empty white around the two characters. A button should sit on
 * what you can see.
 *
 * The one to know about: the seal's layer is a 45 x 45 plate, but its lower
 * half is the mountain's white slope, which the build flattens into the
 * background. So the visible mark — and this box — is the top 24px. Swap in
 * h: 45 if you would rather have the taller tap target.
 */
export const LANDING_VIEWBOX = { w: 390, h: 844 };

export const LANDING_ART = '/landing/landing-mobile.svg';

export type LandingHit = {
  id: string;
  /** what a screen reader announces, and what the destination is for */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export const LANDING_HITS: LandingHit[] = [
  { id: 'logo', label: '遠東', x: 46, y: 28, w: 38, h: 86 },
  { id: 'seal', label: 'Seal', x: 315, y: 24, w: 45, h: 24 },
  { id: 'offers', label: 'Offers', x: 48, y: 161, w: 192, h: 37 },
  { id: 'saved', label: 'My Saved', x: 48, y: 211, w: 88, h: 18 },
  { id: 'recommended', label: 'Recommended', x: 48, y: 242, w: 135, h: 13 },
  { id: 'luck', label: 'Test your luck', x: 111, y: 674, w: 169, h: 49 },
];
