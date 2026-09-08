// The splash plays a faithful copy of scripts/assets/login-source.gif, baked to
// scrubbable WebP stills by `npm run build:splash` (recoloured, sharpened, with
// the red seal fading as it drains and the red clouds rising to full opacity).
// The frames keep the original login box exactly as drawn — that IS the visual;
// once the form is up SplashLoginFields wipes its interior (the black labels, ☁
// and dashes) white, keeps the baked red border, and lays transparent functional
// inputs over it. Nothing decodes a GIF at runtime.
// `edge.webp` is the final pattern with the box reflected over — tiled beside
// the frame to continue the design to the screen edges.
//
// 101 frames, 40ms apart — exactly the source timing, 4.00s.

export const SPLASH_FRAME_MS = 40;
export const SPLASH_FRAME_COUNT = 101;
export const SPLASH_DURATION_MS = (SPLASH_FRAME_COUNT - 1) * SPLASH_FRAME_MS; // 4000

// How far down the frame the cloud pattern has spread, per frame (0..1). Printed
// by build-splash-frames.mjs. Used to reveal the edge tiles in step with it.
// prettier-ignore
export const SPLASH_SPREAD = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0.279,0.279,0.313,0.314,0.315,0.316,0.341,0.341,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.346,0.368,0.368,0.369,0.369,0.369,0.369,0.369,0.433,0.434,0.434,0.436,0.454,0.464,0.504,0.54,0.586,0.629,0.637,0.649,0.672,0.707,0.729,0.753,0.775,0.779,0.814,0.831,0.831,0.831,0.849,0.884,0.886,0.886,0.908,0.943,0.961,0.992,1,1,1,1,1];

export function spreadAt(ms: number): number {
  const f = ms / SPLASH_FRAME_MS;
  const i = Math.max(0, Math.min(SPLASH_SPREAD.length - 1, Math.floor(f)));
  const j = Math.min(SPLASH_SPREAD.length - 1, i + 1);
  const t = f - i;
  return SPLASH_SPREAD[i] * (1 - t) + SPLASH_SPREAD[j] * t;
}

// Everything measured off the baked last frame (f100), as fractions.
export const SPLASH_GEOM = {
  frame: { w: 720, h: 1600 },
  // frame 0: the seal panel — the press-and-hold target, centred.
  seal: { cx: 0.5, cy: 0.5, size: 0.34 }, // fraction of frame width
  // the login box outline's exact footprint (its outer red border edges) — the
  // baked box is already dead-centre.
  box: { x0: 0.3312, x1: 0.6672, y0: 0.4241, y1: 0.5752 },
  boxDy: 0, // vertical nudge of the drawn frame (fraction of height)
  // per row (fractions of the BOX, measured off f100): the dashed line's y (it
  // runs the full width [left..0.89]); the label's right edge; the ☁ glyph's
  // x-span; and the label/☁ vertical band. Typed text starts at `left`, baseline
  // just above dashY.
  rows: {
    email:    { dashY: 0.228, left: 0.102, labelR: 0.356, cloudX0: 0.360, cloudX1: 0.478, top: 0.120, bot: 0.210 },
    password: { dashY: 0.559, left: 0.102, labelR: 0.569, cloudX0: 0.574, cloudX1: 0.690, top: 0.452, bot: 0.540 },
    submit:   { dashY: 0.850, left: 0.102, labelR: 0.813, cloudX0: 0.817, cloudX1: 0.892, top: 0.798, bot: 0.892 },
  },
};

const src = (i: number) => `/splash/frames/f${String(i).padStart(3, '0')}.webp`;

let frames: HTMLImageElement[] | null = null;
let edge: HTMLImageElement | null = null;

export function splashFrames(): HTMLImageElement[] {
  if (!frames) {
    frames = Array.from({ length: SPLASH_FRAME_COUNT }, (_, i) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src(i);
      return img;
    });
  }
  return frames;
}

/** The scaled backdrop pattern (box painted over), drawn behind the frame. */
export function edgeImage(): HTMLImageElement {
  if (!edge) {
    edge = new Image();
    edge.decoding = 'async';
    edge.src = '/splash/edge.webp';
  }
  return edge;
}

export function preloadSplashFrames(): Promise<void> {
  const imgs = splashFrames();
  imgs.forEach((img) => void img.decode().catch(() => {}));
  void edgeImage().decode().catch(() => {});
  return imgs[0].decode().catch(() => {});
}

export function frameAt(ms: number): number {
  const imgs = splashFrames();
  let i = Math.round(ms / SPLASH_FRAME_MS);
  i = i < 0 ? 0 : i >= imgs.length ? imgs.length - 1 : i;
  while (i > 0 && !(imgs[i].complete && imgs[i].naturalWidth)) i--;
  return i;
}

/** The whole frame fit inside a w×h box (contain) and centred — source scale. */
export function coverRect(boxW: number, boxH: number) {
  const { w: iw, h: ih } = SPLASH_GEOM.frame;
  const scale = Math.min(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h, scale };
}
